const config = require('./config');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const log4js = require('log4js');

const sqlite3 = require('sqlite3')
const {open} = require('sqlite')

const lockfile = require('proper-lockfile');

var http = require('http');
var https = require('https');

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

const sendmail = require('sendmail')();

const htmlspecialchars = require('htmlspecialchars');

const dirTree = require("directory-tree");
const execSync = require('child_process').execSync;

const {drivesModel} = require('./models/index');
const {authenticationController} = require('./controllers/authentication');

var db = null;

var totalStorageUsed = null; // global variable that is regularly updated in the background to track the total used storage


log4js.configure({
    appenders: {logfile: {type: "file", filename: "server.log"}, out: {type: "console"}},
    categories: {default: {appenders: ['out', 'logfile'], level: 'info'}}
});

var logger = log4js.getLogger('default');

function initializeStorage() {
    var verifiedPath = mkDirByPathSync(config.storagePath, {isRelativeToScript: (config.storagePath.indexOf("/") === 0 ? false : true)});
    if (verifiedPath != null)
        logger.info("Verified storage path " + verifiedPath);
    else {
        logger.error("Unable to verify storage path '" + config.storagePath + "', check filesystem / permissions");
        process.exit();
    }
}

function validateJWTToken(token, publicKey) {
    try {
        var decoded = jwt.verify(token.replace("JWT ", ""), publicKey, {algorithms: ['RS256']});
        return decoded;
    } catch (exception) {
        logger.error(exception);
    }
    return null;
}

function formatDate(timestampMs) {
    return new Date(timestampMs).toISOString().replace(/T/, ' ').replace(/\..+/, '');
}

function formatDuration(durationSeconds) {
    durationSeconds = Math.round(durationSeconds);
    var secs = durationSeconds % 60;
    var mins = Math.floor(durationSeconds / 60);
    var hours = Math.floor(mins / 60);
    mins = mins % 60;

    var response = '';
    if (hours > 0) response += hours + 'h ';
    if (hours > 0 || mins > 0) response += mins + 'm ';
    response += secs + 's';
    return response;
}

function mkDirByPathSync(targetDir, {isRelativeToScript = false} = {}) {
    const sep = path.sep;
    const initDir = path.isAbsolute(targetDir) ? sep : '';
    const baseDir = isRelativeToScript ? __dirname : '.';

    return targetDir.split(sep).reduce((parentDir, childDir) => {
        const curDir = path.resolve(baseDir, parentDir, childDir);
        try {
            fs.mkdirSync(curDir);
        } catch (err) {
            if (err.code === 'EEXIST') { // curDir already exists!
                return curDir;
            }

            // To avoid `EISDIR` error on Mac and `EACCES`-->`ENOENT` and `EPERM` on Windows.
            if (err.code === 'ENOENT') { // Throw the original parentDir error on curDir `ENOENT` failure.
                logger.error(`EACCES: permission denied, mkdir '${parentDir}'`);
                return null;
            }

            const caughtErr = ['EACCES', 'EPERM', 'EISDIR'].indexOf(err.code) > -1;
            if (!caughtErr || (caughtErr && curDir === path.resolve(targetDir))) {
                logger.error("'EACCES', 'EPERM', 'EISDIR' during mkdir");
                return null;
            }
        }

        return curDir;
    }, initDir);
}

function simpleStringify(object) {
    var simpleObject = {};
    for (var prop in object) {
        if (!object.hasOwnProperty(prop)) {
            continue;
        }
        if (typeof (object[prop]) == 'object') {
            continue;
        }
        if (typeof (object[prop]) == 'function') {
            continue;
        }
        simpleObject[prop] = object[prop];
    }
    return JSON.stringify(simpleObject); // returns cleaned up JSON
}

function writeFileSync(path, buffer, permission) {
    var fileDescriptor;
    try {
        fileDescriptor = fs.openSync(path, 'w', permission);
    } catch (e) {
        fs.chmodSync(path, permission);
        fileDescriptor = fs.openSync(path, 'w', permission);
    }

    if (fileDescriptor) {
        fs.writeSync(fileDescriptor, buffer, 0, buffer.length, 0);
        fs.closeSync(fileDescriptor);
        logger.info("writeFileSync wiriting to '" + path + "' successful");
        return true;
    }
    logger.error("writeFileSync writing to '" + path + "' failed");
    return false;
}

function moveUploadedFile(buffer, directory, filename) {
    logger.info("moveUploadedFile called with '" + filename + "' -> '" + directory + "'");

    if (directory.indexOf("..") >= 0 || filename.indexOf("..") >= 0) {
        logger.error("moveUploadedFile failed, .. in directory or filename");
        return false;
    }

    if (config.storagePath.lastIndexOf("/") !== config.storagePath.length - 1)
        directory = '/' + directory;
    if (directory.lastIndexOf("/") !== directory.length - 1)
        directory = directory + '/';

    var finalPath = mkDirByPathSync(config.storagePath + directory, {isRelativeToScript: (config.storagePath.indexOf("/") === 0 ? false : true)});
    if (finalPath && finalPath.length > 0) {
        if (writeFileSync(finalPath + "/" + filename, buffer, 0o660)) {
            logger.info("moveUploadedFile successfully written '" + (finalPath + "/" + filename) + "'");
            return finalPath + "/" + filename;
        }
        logger.error("moveUploadedFile failed to writeFileSync");
        return false;
    }
    logger.error("moveUploadedFile invalid final path, check permissions to create / write '" + (config.storagePath + directory) + "'");
    return false;
}

async function getAuthenticatedAccount(req) {
    var sessionCookie = (req.signedCookies !== undefined ? req.signedCookies.session : null);
    if (!sessionCookie || sessionCookie.expires <= Date.now()) {
        return null;
    }

    const account = await db.get('SELECT * FROM accounts WHERE LOWER(email) = ?', sessionCookie.account.trim().toLowerCase());
    if (!account || account.banned) {
        res.clearCookie('session');
        return null;
    }
    const result = await db.run('UPDATE accounts SET last_ping = ? WHERE email = ?', Date.now(), account.email);
    return account;
}

function updateTotalStorageUsed() {
    var verifiedPath = mkDirByPathSync(config.storagePath, {isRelativeToScript: (config.storagePath.indexOf("/") === 0 ? false : true)});
    if (verifiedPath !== null) {
        totalStorageUsed = execSync("du -hs " + verifiedPath + " | awk -F'\t' '{print $1;}'").toString();
    }
    setTimeout(function () {
        updateTotalStorageUsed();
    }, 120000); // update the used storage each 120 seconds
}

function runAsyncWrapper(callback) {
    return function (req, res, next) {
        callback(req, res, next)
            .catch(next)
    }
}


// CREATE OUR SERVER EXPRESS APP
const app = express();
app.use(cors());
app.use(cookieParser(config.applicationSalt))

app.use('/favicon.ico', express.static('static/favicon.ico'));

app.use(config.baseDriveDownloadPathMapping, express.static(config.storagePath));
app.use('/.well-known', express.static('.well-known'));

// DRIVE & BOOT/CRASH LOG FILE UPLOAD HANDLING
app.put('/backend/post_upload', bodyParser.raw({
    inflate: true,
    limit: '100000kb',
    type: '*/*'
}), runAsyncWrapper(async (req, res) => {
    var buf = new Buffer(req.body.toString('binary'), 'binary');
    logger.info("HTTP.PUT /backend/post_upload for dongle " + req.query.dongleId + " with body length: " + buf.length);

    var dongleId = req.query.dongleId;
    var ts = req.query.ts;

    if (req.query.file.indexOf("boot") != 0 && req.query.file.indexOf("crash") != 0) { // drive file upload
        var filename = req.query.file;
        var directory = req.query.dir;
        var token = crypto.createHmac('sha256', config.applicationSalt).update(dongleId + filename + directory + ts).digest('hex');

        logger.info("HTTP.PUT /backend/post_upload DRIVE upload with filename: " + filename + ", directory: " + directory + ", token: " + req.query.token);

        if (token !== req.query.token) {
            logger.error("HTTP.PUT /backend/post_upload token mismatch (" + token + " vs " + req.query.token + ")");
            res.status(400);
            res.send('Malformed request');

        } else {
            logger.info("HTTP.PUT /backend/post_upload permissions checked, calling moveUploadedFile");
            var moveResult = moveUploadedFile(buf, directory, filename);
            if (moveResult === false) {
                logger.error("HTTP.PUT /backend/post_upload moveUploadedFile failed");
                res.status(500);
                res.send('Internal Server Error');
            } else {
                logger.info("HTTP.PUT /backend/post_upload succesfully uploaded to " + moveResult);
                res.status(200);
                res.json(['OK']);
            }
        }
    } else {  // boot or crash upload
        var filename = req.query.file;
        var token = crypto.createHmac('sha256', config.applicationSalt).update(dongleId + filename + ts).digest('hex');
        var directory = req.query.dir;

        logger.info("HTTP.PUT /backend/post_upload BOOT or CRASH upload with filename: " + filename + ", token: " + req.query.token);
        if (token !== req.query.token) {
            logger.error("HTTP.PUT /backend/post_upload token mismatch (" + token + " vs " + req.query.token + ")");
            res.status(400);
            res.send('Malformed request');

        } else {
            logger.info("HTTP.PUT /backend/post_upload permissions checked, calling moveUploadedFile");
            var moveResult = moveUploadedFile(buf, directory, filename);
            if (moveResult === false) {
                logger.error("HTTP.PUT /backend/post_upload moveUploadedFile failed");
                res.status(500);
                res.send('Internal Server Error');
            } else {
                logger.info("HTTP.PUT /backend/post_upload succesfully uploaded to " + moveResult);
                res.status(200);
                res.json(['OK']);
            }
        }
    }
})),


// DRIVE & BOOT/CRASH LOG FILE UPLOAD URL REQUEST
    app.get('/v1.3/:dongleId/upload_url/', runAsyncWrapper(async (req, res) => {
        var path = req.query.path;
        logger.info("HTTP.UPLOAD_URL called for " + req.params.dongleId + " and file " + path + ": " + JSON.stringify(req.headers));

        const dongleId = req.params.dongleId;
        const auth = req.params.authorization;

        const device = await drivesModel.getDevice(dongleId);

        if (!device) {
            logger.info(`HTTP.UPLOAD_URL device ${dongleId} not found or not linked to an account / refusing uploads`);
            return res.send('Unauthorized.').status(400)
        }

        let decoded = device.public_key ? await authenticationController.validateJWT(req.headers.authorization, device.public_key) : null;

        if (decoded === null || decoded.identity !== req.params.dongleId) {
            logger.info(`HTTP.UPLOAD_URL JWT authorization failed, token: ${auth} device: ${JSON.stringify(device)}, decoded: ${JSON.stringify(decoded)}`);
            return res.send('Unauthorized.').status(400)
        }

        await drivesModel.deviceCheckIn(dongleId)

        let responseUrl = null;
        const ts = Date.now(); // we use this to make sure old URLs cannot be reused (timeout after 60min)

        const dongleIdHash = crypto.createHmac('sha256', config.applicationSalt).update(dongleId).digest('hex');

        // boot log upload

        if (path.indexOf("boot/") === 0 || path.indexOf("crash/") === 0) {
            let filename = path.replace("/", "-");
            const token = crypto.createHmac('sha256', config.applicationSalt).update(dongleId + filename + ts).digest('hex');

            // TODO, allow multiple types
            let uplaodType = path.indexOf("boot/") === 0 ? 'boot' : 'crash';

            // "boot-2021-04-12--01-45-30.bz" for example
            const directory = `${dongleId}/${dongleIdHash}/${uplaodType}`;
            responseUrl = `${config.baseUploadUrl}?file=${filename}&dir=${directory}&dongleId=${dongleId}&ts=${ts}&token=${token}`;
            logger.info(`HTTP.UPLOAD_URL matched '${uplaodType}' file upload, constructed responseUrl: ${responseUrl}`);
        } else {
            // "2021-04-12--01-44-25--0/qlog.bz2" for example
            const subdirPosition = path.split("--", 2).join("--").length;
            const filenamePosition = path.indexOf("/");
            if (subdirPosition > 0 && filenamePosition > subdirPosition) {
                const driveName = path.split("--")[0] + "--" + path.split("--")[1];
                const segment = parseInt(path.split("--")[2].substr(0, path.split("--")[2].indexOf("/")));
                let directory = path.split("--")[0] + "--" + path.split("--")[1] + "/" + segment;
                const filename = path.split("/")[1];

                let validRequest = false;

                if (filename === 'fcamera.hevc' || filename === 'qcamera.ts' || filename === 'dcamera.hevc' || filename === 'rlog.bz2' || filename === 'qlog.bz2') {
                    validRequest = true;
                } else if (isNaN(segment) || segment < 0 || segment > 10000) {
                    validRequest = false;
                }

                if (!validRequest) {
                    logger.error(`HTTP.UPLOAD_URL invalid filename (${filename}) or invalid segment (${segment}), responding with HTTP 400`);
                    return res.send('Malformed Request.').status(400)
                }

                const driveIdentifierHash = crypto.createHmac('sha256', config.applicationSalt).update(driveName).digest('hex');

                directory = `${dongleId}/${dongleIdHash}/${driveIdentifierHash}/${directory}`;

                const token = crypto.createHmac('sha256', config.applicationSalt).update(dongleId + filename + directory + ts).digest('hex');
                responseUrl = `${config.baseUploadUrl}?file=${filename}&dir=${directory}&dongleId=${dongleId}&ts=${ts}&token=${token}`;
                logger.info(`HTTP.UPLOAD_URL matched 'drive' file upload, constructed responseUrl: ${responseUrl}`);

                const drive = await db.get('SELECT * FROM drives WHERE identifier = ? AND dongle_id = ?', driveName, dongleId);

                if (drive == null) {
                    // create a new drive
                    const timeSplit = driveName.split('--');
                    const timeString = timeSplit[0] + ' ' + timeSplit[1].replace(/-/g, ':');

                    const driveResult = await db.run(
                        'INSERT INTO drives (identifier, dongle_id, max_segment, duration, distance_meters, filesize, upload_complete, is_processed, drive_date, created, last_upload, is_preserved, is_deleted, is_physically_removed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                        driveName, dongleId, segment, 0, 0, 0, false, false, Date.parse(timeString), Date.now(), Date.now(), false, false, false);


                    const driveSegmentResult = await db.run(
                        'INSERT INTO drive_segments (segment_id, drive_identifier, dongle_id, duration, distance_meters, upload_complete, is_processed, is_stalled, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                        segment, driveName, dongleId, 0, 0, false, false, false, Date.now());

                    logger.info("HTTP.UPLOAD_URL created new drive #" + JSON.stringify(driveResult.lastID));
                } else {
                    const driveResult = await db.run(
                        'UPDATE drives SET last_upload = ?, max_segment = ?, upload_complete = ?, is_processed = ?  WHERE identifier = ? AND dongle_id = ?',
                        Date.now(), Math.max(drive.max_segment, segment), false, false, driveName, dongleId
                    );

                    const drive_segment = await db.get('SELECT * FROM drive_segments WHERE drive_identifier = ? AND dongle_id = ? AND segment_id = ?', driveName, dongleId, segment);

                    if (drive_segment == null) {
                        const driveSegmentResult = await db.run(
                            'INSERT INTO drive_segments (segment_id, drive_identifier, dongle_id, duration, distance_meters, upload_complete, is_processed, is_stalled, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                            segment, driveName, dongleId, 0, 0, false, false, false, Date.now()
                        );
                    } else {
                        const driveSegmentResult = await db.run(
                            'UPDATE drive_segments SET upload_complete = ?, is_stalled = ? WHERE drive_identifier = ? AND dongle_id = ? AND segment_id = ?',
                            false, false, driveName, dongleId, segment
                        );
                    }

                    logger.info("HTTP.UPLOAD_URL updated existing drive: " + JSON.stringify(drive));
                }

            }
        }

        if (responseUrl != null) {
            res.status(200);
            res.json({'url': responseUrl, 'headers': {'Content-Type': 'application/octet-stream'}});
        } else {
            logger.error("HTTP.UPLOAD_URL unable to match request, responding with HTTP 400");
            res.status(400);
            res.send('Malformed Request.');
        }
    })),


// DEVICE REGISTRATION OR RE-ACTIVATION
    app.post('/v2/pilotauth/', bodyParser.urlencoded({extended: true}), runAsyncWrapper(async (req, res) => {
        var imei1 = req.query.imei;
        var serial = req.query.serial;
        var public_key = req.query.public_key;
        var register_token = req.query.register_token;

        if (imei1 == null || imei1.length < 5 || serial == null || serial.length < 5 || public_key == null || public_key.length < 5 || register_token == null || register_token.length < 5) {
            logger.error("HTTP.V2.PILOTAUTH a required parameter is missing or empty");
            res.status(400);
            res.send('Malformed Request.');
            return;
        }

        var decoded = validateJWTToken(req.query.register_token, public_key);

        if (decoded == null || decoded.register == undefined) {
            logger.error("HTTP.V2.PILOTAUTH JWT token is invalid (" + JSON.stringify(decoded) + ")");
            res.status(400);
            res.send('Malformed Request.');
            return;
        }

        const device = await db.get('SELECT * FROM devices WHERE imei = ? AND serial = ?', imei1, serial);
        if (device == null) {
            logger.info("HTTP.V2.PILOTAUTH REGISTERING NEW DEVICE (" + imei1 + ", " + serial + ")");
            while (true) {
                var dongleId = crypto.randomBytes(4).toString('hex');
                const isDongleIdTaken = await db.get('SELECT * FROM devices WHERE imei = ? AND serial = ?', imei1, serial);
                if (isDongleIdTaken == null) {
                    const resultingDevice = await db.run(
                        'INSERT INTO devices (dongle_id, account_id, imei, serial, device_type, public_key, created, last_ping, storage_used) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                        dongleId, 0, imei1, serial, 'freon', public_key, Date.now(), Date.now(), 0);

                    const device = await db.get('SELECT * FROM devices WHERE dongle_id = ?', dongleId);

                    logger.info("HTTP.V2.PILOTAUTH REGISTERED NEW DEVICE: " + JSON.stringify(device));
                    res.status(200);
                    res.json({dongle_id: device.dongle_id});
                    return;
                }
            }
        } else {
            const result = await db.run(
                'UPDATE devices SET last_ping = ?, public_key = ? WHERE dongle_id = ?',
                Date.now(), public_key, device.dongle_id
            );

            logger.info("HTTP.V2.PILOTAUTH REACTIVATING KNOWN DEVICE (" + imei1 + ", " + serial + ") with dongle_id " + device.dongle_id + "");
            res.status(200);
            res.json({dongle_id: device.dongle_id});

        }
    })),


// RETRIEVES DATASET FOR OUR MODIFIED CABANA - THIS RESPONSE IS USED TO FAKE A DEMO ROUTE
    app.get('/useradmin/cabana_drive/:extendedRouteIdentifier', runAsyncWrapper(async (req, res) => {

        var params = req.params.extendedRouteIdentifier.split('|');
        var dongleId = params[0];
        var dongleIdHashReq = params[1];
        var driveIdentifier = params[2];
        var driveIdentifierHashReq = params[3];

        const drive = await db.get('SELECT * FROM drives WHERE identifier = ? AND dongle_id = ?', driveIdentifier, dongleId);

        if (!drive) {
            res.status(200);
            res.json({'status': 'drive not found'});
            return;
        }

        var dongleIdHash = crypto.createHmac('sha256', config.applicationSalt).update(drive.dongle_id).digest('hex');
        var driveIdentifierHash = crypto.createHmac('sha256', config.applicationSalt).update(drive.identifier).digest('hex');
        var driveUrl = config.baseDriveDownloadUrl + drive.dongle_id + "/" + dongleIdHash + "/" + driveIdentifierHash + "/" + drive.identifier;

        if (dongleIdHash != dongleIdHashReq || driveIdentifierHash != driveIdentifierHashReq) {
            res.status(200);
            res.json({'status': 'hashes not matching'});
            return;
        }

        if (!drive.is_processed) {
            res.status(200);
            res.json({'status': 'drive is not processed yet'});
            return;
        }


        var logUrls = [];

        for (var i = 0; i <= drive.max_segment; i++) {
            logUrls.push(driveUrl + '/' + i + '/rlog.bz2');
        }

        res.status(200);
        res.json({
            logUrls: logUrls,
            driveUrl: driveUrl,
            name: drive.dongle_id + '|' + drive.identifier,
            driveIdentifier: drive.identifier,
            dongleId: drive.dongle_id
        });
    })),


//////////////////////////////////////////////////////////////////////
// BEGINNING OF THE USERADMIN routes / interface                    //
//////////////////////////////////////////////////////////////////////


    app.post('/useradmin/auth', bodyParser.urlencoded({extended: true}), runAsyncWrapper(async (req, res) => {
        const account = await db.get('SELECT * FROM accounts WHERE email = ? AND password = ?', req.body.email, crypto.createHash('sha256').update(req.body.password + config.applicationSalt).digest('hex'));


        if (!account || account.banned) {
            res.status(200);
            res.redirect('/useradmin?status=' + encodeURIComponent('Invalid credentials or banned account'));
            return;
        }
        res.cookie('session', {account: account.email, expires: Date.now() + 1000 * 3600 * 24 * 365}, {signed: true});
        res.redirect('/useradmin/overview');
    })),


    app.get('/useradmin/signout', runAsyncWrapper(async (req, res) => {
        res.clearCookie('session');
        res.redirect('/useradmin');
    })),


    app.get('/useradmin', runAsyncWrapper(async (req, res) => {
        const account = await getAuthenticatedAccount(req);
        if (account != null) {
            res.redirect('/useradmin/overview');
            return;
        }

        const accounts = await db.get('SELECT COUNT(*) AS num FROM accounts');
        const devices = await db.get('SELECT COUNT(*) AS num FROM devices');
        const drives = await db.get('SELECT COUNT(*) AS num FROM drives');

        res.status(200);
        res.send('<html style="font-family: monospace"><h2>Welcome To The RetroPilot Server Dashboard!</h2>' +
            `<br><br>
                <h3>Login</h3>
                ` + (req.query.status !== undefined ? '<u>' + htmlspecialchars(req.query.status) + '</u><br>' : '') + `
                <form action="/useradmin/auth" method="POST">
                <input type="email" name="email" placeholder="Email" required>
                <input type="password" name="password" placeholder="Password" required>
                <input type="submit">
                </form><br><br>` + (!config.allowAccountRegistration ? '<i>User Account Registration is disabled on this Server</i>' : '<a href="/useradmin/register">Register new Account</a>') + `<br><br>` +
            'Accounts: ' + accounts.num + '  |  ' +
            'Devices: ' + devices.num + '  |  ' +
            'Drives: ' + drives.num + '  |  ' +
            'Storage Used: ' + (totalStorageUsed !== null ? totalStorageUsed : '--') + '<br><br>' + config.welcomeMessage + '</html>');
    })),


    app.post('/useradmin/register/token', bodyParser.urlencoded({extended: true}), runAsyncWrapper(async (req, res) => {
        if (!config.allowAccountRegistration) {
            res.status(400);
            res.send('Unauthorized.');
            return;
        }

        const authAccount = await getAuthenticatedAccount(req);
        if (authAccount != null) {
            res.redirect('/useradmin/overview');
            return;
        }

        const account = await db.get('SELECT * FROM accounts WHERE LOWER(email) = ?', req.body.email.trim().toLowerCase());
        if (account != null) {
            res.redirect('/useradmin/register?status=' + encodeURIComponent('Email is already registered'));
            return;
        }

        var token = crypto.createHmac('sha256', config.applicationSalt).update(req.body.email.trim()).digest('hex');

        var infoText = '';

        if (req.body.token == undefined) { // email entered, token request
            logger.info("USERADMIN REGISTRATION sending token to " + htmlspecialchars(req.body.email.trim()) + ": \"" + token + "\"");
            infoText = 'Please check your inbox (<b>SPAM</b>) for an email with the registration token.<br>If the token was not delivered, please ask the administrator to check the <i>server.log</i> for the token generated for your email.<br><br>';

            sendmail({
                from: 'no-reply@retropilot.com',
                to: req.body.email.trim(),
                subject: 'RetroPilot Registration Token',
                html: 'Your Email Registration Token Is: "' + token + '"',
            }, function (err, reply) {
                if (err)
                    logger.error("USERADMIN REGISTRATION - failed to send registration token email " + (err && err.stack) + "  " + reply);
            });
        } else { // final registration form filled
            if (req.body.token != token) {
                infoText = 'The registration token you entered was incorrect, please try again.<br><br>';
            } else if (req.body.password != req.body.password2 || req.body.password.length < 3) {
                infoText = 'The passwords you entered did not or were shorter than 3 characters, please try again.<br><br>';
            } else {

                const result = await db.run(
                    'INSERT INTO accounts (email, password, created, banned) VALUES (?, ?, ?, ?)',
                    req.body.email,
                    crypto.createHash('sha256').update(req.body.password + config.applicationSalt).digest('hex'),
                    Date.now(), false);

                if (result.lastID != undefined) {
                    logger.info("USERADMIN REGISTRATION - created new account #" + result.lastID + " with email " + req.body.email + "");
                    res.cookie('session', {
                        account: req.body.email,
                        expires: Date.now() + 1000 * 3600 * 24 * 365
                    }, {signed: true});
                    res.redirect('/useradmin/overview');
                    return;
                } else {
                    logger.error("USERADMIN REGISTRATION - account creation failed, resulting account data for email " + req.body.email + " is: " + result);
                    infoText = 'Unable to complete account registration (database error).<br><br>';
                }
            }
        }

        res.status(200);
        res.send('<html style="font-family: monospace"><h2>Welcome To The RetroPilot Server Dashboard!</h2>' +
            `
                <a href="/useradmin">< < < Back To Login</a>
                <br><br>
                <h3>Register / Finish Registration</h3>
                ` + infoText + `
                <form action="/useradmin/register/token" method="POST">
                <input type="email" name="email" placeholder="Email" value="` + htmlspecialchars(req.body.email.trim()) + `"required>
                <input type="text" name="token" placeholder="Email Token" value="` + (req.body.token != undefined ? htmlspecialchars(req.body.token.trim()) : '') + `" required><br>
                <input type="password" name="password" placeholder="Password"  value="` + (req.body.password != undefined ? htmlspecialchars(req.body.password.trim()) : '') + `" required>
                <input type="password" name="password2" placeholder="Repeat Password"  value="` + (req.body.password2 != undefined ? htmlspecialchars(req.body.password2.trim()) : '') + `" required>
                <input type="submit" value="Finish Registration">
                </html>`);
    })),


    app.get('/useradmin/register', runAsyncWrapper(async (req, res) => {
        if (!config.allowAccountRegistration) {
            res.status(400);
            res.send('Unauthorized.');
            return;
        }

        const account = await getAuthenticatedAccount(req);
        if (account != null) {
            res.redirect('/useradmin/overview');
            return;
        }

        res.status(200);
        res.send('<html style="font-family: monospace"><h2>Welcome To The RetroPilot Server Dashboard!</h2>' +
            `
                <a href="/useradmin">< < < Back To Login</a>
                <br><br>
                <h3>Register / Request Email Token</h3>
                ` + (req.query.status !== undefined ? '<u>' + htmlspecialchars(req.query.status) + '</u><br>' : '') + `
                <form action="/useradmin/register/token" method="POST">
                <input type="email" name="email" placeholder="Email" required>
                <input type="submit" value="Verify Email">
                </html>`);
    })),


    app.get('/useradmin/overview', runAsyncWrapper(async (req, res) => {
        const account = await getAuthenticatedAccount(req);
        if (account == null) {
            res.redirect('/useradmin?status=' + encodeURIComponent('Invalid or expired session'));
            return;
        }

        const devices = await db.all('SELECT * FROM devices WHERE account_id = ? ORDER BY dongle_id ASC', account.id)

        var response = '<html style="font-family: monospace"><h2>Welcome To The RetroPilot Server Dashboard!</h2>' +

            `<br><br><h3>Account Overview</h3>
                <b>Account:</b> #` + account.id + `<br>
                <b>Email:</b> ` + account.email + `<br>
                <b>Created:</b> ` + formatDate(account.created) + `<br><br>
                <b>Devices:</b><br>
                <table border=1 cellpadding=2 cellspacing=2>
                    <tr><th>dongle_id</th><th>device_type</th><th>created</th><th>last_ping</th><th>storage_used</th></tr>
                `;

        for (var i in devices) {
            response += '<tr><td><a href="/useradmin/device/' + devices[i].dongle_id + '">' + devices[i].dongle_id + '</a></td><td>' + devices[i].device_type + '</td><td>' + formatDate(devices[i].created) + '</td><td>' + formatDate(devices[i].last_ping) + '</td><td>' + devices[i].storage_used + ' MB</td></tr>';
        }
        response += `</table>
                <br>
                <hr/>
                <h3>Pair New Devices</h3>
                <i>* To pair a new device, first have it auto-register on this server.<br>Then scan the QR Code and paste the Device Token below.</i><br>
                ` + (req.query.linkstatus !== undefined ? '<br><u>' + htmlspecialchars(req.query.linkstatus) + '</u><br><br>' : '') + `
                <form action="/useradmin/pair_device" method="POST">
                <input type="text" name="qr_string" placeholder="QR Code Device Token" required>
                <input type="submit" value="Pair">
                </form><br><br>
                <hr/>
                <a href="/useradmin/signout">Sign Out</a>`;

        res.status(200);
        res.send(response);

    })),


    app.get('/useradmin/unpair_device/:dongleId', runAsyncWrapper(async (req, res) => {
        const account = await getAuthenticatedAccount(req);
        if (account == null) {
            res.redirect('/useradmin?status=' + encodeURIComponent('Invalid or expired session'));
            return;
        }

        const device = await db.get('SELECT * FROM devices WHERE account_id = ? AND dongle_id = ?', account.id, req.params.dongleId);

        if (device == null) {
            res.status(400);
            res.send('Unauthorized.');
            return;
        }

        const result = await db.run(
            'UPDATE devices SET account_id = ? WHERE dongle_id = ?',
            0,
            req.params.dongleId
        );

        res.redirect('/useradmin/overview');
    })),


    app.post('/useradmin/pair_device', bodyParser.urlencoded({extended: true}), runAsyncWrapper(async (req, res) => {
        const account = await getAuthenticatedAccount(req);
        if (account == null) {
            res.redirect('/useradmin?status=' + encodeURIComponent('Invalid or expired session'));
            return;
        }

        var qrCodeParts = req.body.qr_string.split("--"); // imei, serial, jwtToken

        const device = await db.get('SELECT * FROM devices WHERE imei = ? AND serial = ?', qrCodeParts[0], qrCodeParts[1]);
        if (device == null) {
            res.redirect('/useradmin/overview?linkstatus=' + encodeURIComponent('Device not registered on Server'));
        }
        var decoded = validateJWTToken(qrCodeParts[2], device.public_key);
        if (decoded == null || decoded.pair == undefined) {
            res.redirect('/useradmin/overview?linkstatus=' + encodeURIComponent('Device QR Token is invalid or has expired'));
        }
        if (device.account_id != 0) {
            res.redirect('/useradmin/overview?linkstatus=' + encodeURIComponent('Device is already paired, unpair in that account first'));
        }

        const result = await db.run(
            'UPDATE devices SET account_id = ? WHERE dongle_id = ?',
            account.id,
            device.dongle_id
        );

        res.redirect('/useradmin/overview');
    })),


    app.get('/useradmin/device/:dongleId', runAsyncWrapper(async (req, res) => {
        const account = await getAuthenticatedAccount(req);
        if (account == null) {
            res.redirect('/useradmin?status=' + encodeURIComponent('Invalid or expired session'));
            return;
        }

        const device = await db.get('SELECT * FROM devices WHERE account_id = ? AND dongle_id = ?', account.id, req.params.dongleId);

        if (device == null) {
            res.status(400);
            res.send('Unauthorized.');
            return;
        }


        const drives = await db.all('SELECT * FROM drives WHERE dongle_id = ? AND is_deleted = ? ORDER BY created DESC', device.dongle_id, false);

        var dongleIdHash = crypto.createHmac('sha256', config.applicationSalt).update(device.dongle_id).digest('hex');

        const bootlogDirectoryTree = dirTree(config.storagePath + device.dongle_id + "/" + dongleIdHash + "/boot/", {attributes: ['size']});
        var bootlogFiles = [];
        if (bootlogDirectoryTree != undefined) {
            for (var i = 0; i < bootlogDirectoryTree.children.length; i++) {

                var timeSplit = bootlogDirectoryTree.children[i].name.replace('boot-', '').replace('crash-', '').replace('\.bz2', '').split('--');
                var timeString = timeSplit[0] + ' ' + timeSplit[1].replace(/-/g, ':');
                bootlogFiles.push({
                    'name': bootlogDirectoryTree.children[i].name,
                    'size': bootlogDirectoryTree.children[i].size,
                    'date': Date.parse(timeString)
                });
            }
            bootlogFiles.sort((a, b) => (a.date < b.date) ? 1 : -1);
        }

        const crashlogDirectoryTree = dirTree(config.storagePath + device.dongle_id + "/" + dongleIdHash + "/crash/", {attributes: ['size']});
        var crashlogFiles = [];
        if (crashlogDirectoryTree != undefined) {
            for (var i = 0; i < crashlogDirectoryTree.children.length; i++) {

                var timeSplit = crashlogDirectoryTree.children[i].name.replace('boot-', '').replace('crash-', '').replace('\.bz2', '').split('--');
                var timeString = timeSplit[0] + ' ' + timeSplit[1].replace(/-/g, ':');
                crashlogFiles.push({
                    'name': crashlogDirectoryTree.children[i].name,
                    'size': crashlogDirectoryTree.children[i].size,
                    'date': Date.parse(timeString)
                });
            }
            crashlogFiles.sort((a, b) => (a.date < b.date) ? 1 : -1);
        }


        var response = '<html style="font-family: monospace"><h2>Welcome To The RetroPilot Server Dashboard!</h2>' +

            `
                <a href="/useradmin/overview">< < < Back To Overview</a>
                <br><br><h3>Device ` + device.dongle_id + `</h3>
                <b>Type:</b> ` + device.device_type + `<br>
                <b>Serial:</b> ` + device.serial + `<br>
                <b>IMEI:</b> ` + device.imei + `<br>
                <b>Registered:</b> ` + formatDate(device.created) + `<br>
                <b>Last Ping:</b> ` + formatDate(device.last_ping) + `<br>
                <b>Public Key:</b><br><span style="font-size: 0.8em">` + device.public_key.replace(/\r?\n|\r/g, "<br>") + `</span>
                <br>
                <b>Stored Drives:</b> ` + drives.length + `<br>
                <b>Quota Storage:</b> ` + device.storage_used + ` MB / ` + config.deviceStorageQuotaMb + ` MB<br>
                <br>
                `;

        response += `<b>Boot Logs (last 5):</b><br>
            <table border=1 cellpadding=2 cellspacing=2>
            <tr><th>date</th><th>file</th><th>size</th></tr>
        `;
        for (var i = 0; i < Math.min(5, bootlogFiles.length); i++) {
            response += `<tr><td>` + formatDate(bootlogFiles[i].date) + `</td><td><a href="` + config.baseDriveDownloadUrl + device.dongle_id + "/" + dongleIdHash + "/boot/" + bootlogFiles[i].name + `" target=_blank>` + bootlogFiles[i].name + `</a></td><td>` + bootlogFiles[i].size + `</td></tr>`;
        }
        response += `</table><br><br>`;

        response += `<b>Crash Logs (last 5):</b><br>
            <table border=1 cellpadding=2 cellspacing=2>
            <tr><th>date</th><th>file</th><th>size</th></tr>
        `;
        for (var i = 0; i < Math.min(5, crashlogFiles.length); i++) {
            response += `<tr><td>` + formatDate(crashlogFiles[i].date) + `</td><td><a href="` + config.baseDriveDownloadUrl + device.dongle_id + "/" + dongleIdHash + "/crash/" + crashlogFiles[i].name + `" target=_blank>` + crashlogFiles[i].name + `</a></td><td>` + crashlogFiles[i].size + `</td></tr>`;
        }
        response += `</table><br><br>`;


        response += `<b>Drives (non-preserved drives expire ` + config.deviceDriveExpirationDays + ` days after upload):</b><br>
        <table border=1 cellpadding=2 cellspacing=2>
        <tr><th>identifier</th><th>filesize</th><th>duration</th><th>distance_meters</th><th>upload_complete</th><th>is_processed</th><th>upload_date</th><th>actions</th></tr>
    `;

        for (var i in drives) {
            response += '<tr><td><a href="/useradmin/drive/' + drives[i].dongle_id + '/' + drives[i].identifier + '">' + (drives[i].is_preserved ? '<b>' : '') + drives[i].identifier + (drives[i].is_preserved ? '</b>' : '') + '</a></td><td>' + Math.round(drives[i].filesize / 1024) + ' MiB</td><td>' + formatDuration(drives[i].duration) + '</td><td>' + Math.round(drives[i].distance_meters / 1000) + ' km</td><td>' + drives[i].upload_complete + '</td><td>' + drives[i].is_processed + '</td><td>' + formatDate(drives[i].created) + '</td><td>' + '[<a href="/useradmin/drive/' + drives[i].dongle_id + '/' + drives[i].identifier + '/delete" onclick="return confirm(\'Permanently delete this drive?\')">delete</a>]' + (drives[i].is_preserved ? '' : '&nbsp;&nbsp;[<a href="/useradmin/drive/' + drives[i].dongle_id + '/' + drives[i].identifier + '/preserve">preserve</a>]') + '</tr>';
        }
        response += `</table>
                <br>
                <hr/>
                <a href="/useradmin/unpair_device/` + device.dongle_id + `" onclick="return confirm('Are you sure that you want to unpair your device? Uploads will be rejected until it is paired again.')">Unpair Device</a>
                <br><br>
                <hr/>
                <a href="/useradmin/signout">Sign Out</a></html>`;

        res.status(200);
        res.send(response);

    })),


    app.get('/useradmin/drive/:dongleId/:driveIdentifier/:action', runAsyncWrapper(async (req, res) => {
        const account = await getAuthenticatedAccount(req);
        if (account == null) {
            res.redirect('/useradmin?status=' + encodeURIComponent('Invalid or expired session'));
            return;
        }

        const device = await db.get('SELECT * FROM devices WHERE account_id = ? AND dongle_id = ?', account.id, req.params.dongleId);

        if (device == null) {
            res.status(400);
            res.send('Unauthorized.');
            return;
        }

        const drive = await db.get('SELECT * FROM drives WHERE identifier = ? AND dongle_id = ?', req.params.driveIdentifier, req.params.dongleId);

        if (drive == null) {
            res.status(400);
            res.send('Unauthorized.');
            return;
        }

        if (req.params.action == 'delete') {
            const result = await db.run(
                'UPDATE drives SET is_deleted = ? WHERE id = ?',
                true, drive.id
            );
        } else if (req.params.action == 'preserve') {
            const result = await db.run(
                'UPDATE drives SET is_preserved = ? WHERE id = ?',
                true, drive.id
            );
        }

        res.redirect('/useradmin/device/' + device.dongle_id);

    })),


    app.get('/useradmin/drive/:dongleId/:driveIdentifier', runAsyncWrapper(async (req, res) => {
        const account = await getAuthenticatedAccount(req);
        if (account == null) {
            res.redirect('/useradmin?status=' + encodeURIComponent('Invalid or expired session'));
            return;
        }

        const device = await db.get('SELECT * FROM devices WHERE account_id = ? AND dongle_id = ?', account.id, req.params.dongleId);

        if (device == null) {
            res.status(400);
            res.send('Unauthorized.');
            return;
        }

        const drive = await db.get('SELECT * FROM drives WHERE identifier = ? AND dongle_id = ?', req.params.driveIdentifier, req.params.dongleId);

        if (drive == null) {
            res.status(400);
            res.send('Unauthorized.');
            return;
        }

        var dongleIdHash = crypto.createHmac('sha256', config.applicationSalt).update(device.dongle_id).digest('hex');
        var driveIdentifierHash = crypto.createHmac('sha256', config.applicationSalt).update(drive.identifier).digest('hex');

        var driveUrl = config.baseDriveDownloadUrl + device.dongle_id + "/" + dongleIdHash + "/" + driveIdentifierHash + "/" + drive.identifier + "/";

        var cabanaUrl = null;
        if (drive.is_processed) {
            cabanaUrl = config.cabanaUrl + '?retropilotIdentifier=' + device.dongle_id + '|' + dongleIdHash + '|' + drive.identifier + '|' + driveIdentifierHash + '&retropilotHost=' + encodeURIComponent(config.baseUrl) + '&demo=1"';
        }

        const directoryTree = dirTree(config.storagePath + device.dongle_id + "/" + dongleIdHash + "/" + driveIdentifierHash + "/" + drive.identifier);


        var response = '<html style="font-family: monospace"><h2>Welcome To The RetroPilot Server Dashboard!</h2>' +
            `
                <a href="/useradmin/device/` + device.dongle_id + `">< < < Back To Device ` + device.dongle_id + `</a>
                <br><br><h3>Drive ` + drive.identifier + ` on ` + drive.dongle_id + `</h3>
                <b>Drive Date:</b> ` + formatDate(drive.drive_date) + `<br>
                <b>Upload Date:</b> ` + formatDate(drive.created) + `<br>
                <b>Num Segments:</b> ` + (drive.max_segment + 1) + `<br>
                <b>Storage:</b> ` + Math.round(drive.filesize / 1024) + ` MiB<br>
                <b>Duration:</b> ` + formatDuration(drive.duration) + `<br>
                <b>Distance:</b> ` + Math.round(drive.distance_meters / 1000) + ` km<br>
                <b>Is Preserved:</b> ` + drive.is_preserved + `<br>
                <b>Upload Complete:</b> ` + drive.upload_complete + `<br>
                <b>Processed:</b> ` + drive.is_processed + `<br>
                <br><br>
                ` + (cabanaUrl ? '<a href="' + cabanaUrl + '" target=_blank><b>View Drive in CABANA</b></a><br><br>' : '') + `
                <b>Files:</b><br>
                <table border=1 cellpadding=2 cellspacing=2>
                    <tr><th>segment</th><th>qcamera</th><th>qlog</th><th>fcamera</th><th>rlog</th><th>dcamera</th><th>processed</th><th>stalled</th></tr>
                `;


        var directorySegments = {};
        for (var i in directoryTree.children) {
            // skip any non-directory entries (for example m3u8 file in the drive directory)
            if (directoryTree.children[i].type != 'directory') continue;

            var segment = directoryTree.children[i].name;


            var qcamera = '--';
            var fcamera = '--';
            var dcamera = '--';
            var qlog = '--';
            var rlog = '--';
            for (var c in directoryTree.children[i].children) {
                if (directoryTree.children[i].children[c].name == 'fcamera.hevc') fcamera = '<a target="_blank" href="' + driveUrl + segment + '/' + directoryTree.children[i].children[c].name + '">' + directoryTree.children[i].children[c].name + '</a>';
                if (directoryTree.children[i].children[c].name == 'dcamera.hevc') fcamera = '<a target="_blank" href="' + driveUrl + segment + '/' + directoryTree.children[i].children[c].name + '">' + directoryTree.children[i].children[c].name + '</a>';
                if (directoryTree.children[i].children[c].name == 'qcamera.ts') qcamera = '<a target="_blank" href="' + driveUrl + segment + '/' + directoryTree.children[i].children[c].name + '">' + directoryTree.children[i].children[c].name + '</a>';
                if (directoryTree.children[i].children[c].name == 'qlog.bz2') qlog = '<a target="_blank" href="' + driveUrl + segment + '/' + directoryTree.children[i].children[c].name + '">' + directoryTree.children[i].children[c].name + '</a>';
                if (directoryTree.children[i].children[c].name == 'rlog.bz2') rlog = '<a target="_blank" href="' + driveUrl + segment + '/' + directoryTree.children[i].children[c].name + '">' + directoryTree.children[i].children[c].name + '</a>';
            }

            var isProcessed = '?';
            var isStalled = '?';

            const drive_segment = await db.get('SELECT * FROM drive_segments WHERE segment_id = ? AND drive_identifier = ? AND dongle_id = ?', parseInt(segment), drive.identifier, device.dongle_id);

            if (drive_segment) {
                isProcessed = drive_segment.is_processed;
                isStalled = drive_segment.is_stalled;
            }

            directorySegments["seg-" + segment] = '<tr><td>' + segment + '</td><td>' + qcamera + '</td><td>' + qlog + '</td><td>' + fcamera + '</td><td>' + rlog + '</td><td>' + dcamera + '</td><td>' + isProcessed + '</td><td>' + isStalled + '</td></tr>';
        }

        var qcamera = '--';
        var fcamera = '--';
        var dcamera = '--';
        var qlog = '--';
        var rlog = '--';
        var isProcessed = '?';
        var isStalled = '?';

        for (var i = 0; i <= drive.max_segment; i++) {
            if (directorySegments["seg-" + i] == undefined) {
                response += '<tr><td>' + i + '</td><td>' + qcamera + '</td><td>' + qlog + '</td><td>' + fcamera + '</td><td>' + rlog + '</td><td>' + dcamera + '</td><td>' + isProcessed + '</td><td>' + isStalled + '</td></tr>';
            } else
                response += directorySegments["seg-" + i];
        }

        response += `</table>
                <br><br>
                <hr/>
                <a href="/useradmin/signout">Sign Out</a></html>`;

        res.status(200);
        res.send(response);

    })),


    app.get('/', runAsyncWrapper(async (req, res) => {
        res.status(404);
        var response = '<html style="font-family: monospace"><h2>404 Not found</h2>' +
            'Are you looking for the <a href="/useradmin">useradmin dashboard</a>?';
        res.send(response);
    })),


    app.get('*', runAsyncWrapper(async (req, res) => {
        logger.error("HTTP.GET unhandled request: " + simpleStringify(req) + ", " + simpleStringify(res) + "")
        res.status(400);
        res.send('Not Implemented');
    })),


    app.post('*', runAsyncWrapper(async (req, res) => {
        logger.error("HTTP.POST unhandled request: " + simpleStringify(req) + ", " + simpleStringify(res) + "")
        res.status(400);
        res.send('Not Implemented');
    }));


lockfile.lock('retropilot_server.lock', {realpath: false, stale: 30000, update: 2000})
    .then((release) => {
        console.log("STARTING SERVER...");

        (async () => {
            try {
                db = await open({
                    filename: config.databaseFile,
                    driver: sqlite3.Database,
                    mode: sqlite3.OPEN_READWRITE
                });
                await db.get('SELECT * FROM accounts LIMIT 1')
                await db.get('SELECT * FROM devices LIMIT 1')
                await db.get('SELECT * FROM drives LIMIT 1')
                await db.get('SELECT * FROM drive_segments LIMIT 1')

            } catch (exception) {
                logger.error(exception);
                process.exit();
            }

            initializeStorage();
            updateTotalStorageUsed();

            var privateKey = fs.readFileSync(config.sslKey, 'utf8');
            var certificate = fs.readFileSync(config.sslCrt, 'utf8');
            var sslCredentials = {key: privateKey, cert: certificate/* ,    ca: fs.readFileSync('certs/ca.crt') */};

            var httpServer = http.createServer(app);
            var httpsServer = https.createServer(sslCredentials, app);

            httpServer.listen(config.httpPort, config.httpInterface, () => {
                logger.info(`Retropilot Server listening at http://` + config.httpInterface + `:` + config.httpPort)
            });
            httpsServer.listen(config.httpsPort, config.httpsInterface, () => {
                logger.info(`Retropilot Server listening at https://` + config.httpsInterface + `:` + config.httpsPort)
            });
        })();

    }).catch((e) => {
    console.error(e)
    process.exit();
});