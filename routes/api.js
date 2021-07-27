const router = require('express').Router();
const bodyParser = require('body-parser');
const crypto = require('crypto');
const config = require('./../config');


function runAsyncWrapper(callback) {
    return function (req, res, next) {
        callback(req, res, next)
            .catch(next)
    }
}

let models;
let controllers;
let logger;





// DRIVE & BOOT/CRASH LOG FILE UPLOAD HANDLING
router.put('/backend/post_upload', bodyParser.raw({
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
            var moveResult = controllers.storage.moveUploadedFile(buf, directory, filename);
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
        var directory = req.query.dir;
        var token = crypto.createHmac('sha256', config.applicationSalt).update(dongleId + filename + directory + ts).digest('hex');

        logger.info("HTTP.PUT /backend/post_upload BOOT or CRASH upload with filename: " + filename + ", token: " + req.query.token);
        if (token !== req.query.token) {
            logger.error("HTTP.PUT /backend/post_upload token mismatch (" + token + " vs " + req.query.token + ")");
            res.status(400);
            res.send('Malformed request');

        } else {
            logger.info("HTTP.PUT /backend/post_upload permissions checked, calling moveUploadedFile");
            var moveResult = controllers.storage.moveUploadedFile(buf, directory, filename);
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
}))


// RETURN THE PAIRING STATUS
router.get('/v1.1/devices/:dongleId/', runAsyncWrapper(async (req, res) => {
    const dongleId = req.params.dongleId;
    logger.info("HTTP.DEVICES called for " + req.params.dongleId + "");
    
    const device = await models.drivesModel.getDevice(dongleId);

    if (!device) {
        logger.info(`HTTP.DEVICES device ${dongleId} not found`);
        let response={'is_paired': false, 'prime': false};
        res.status(200);
        res.json(response);
        return;
    }

    let decoded = device.public_key ? await controllers.authentication.validateJWT(req.headers.authorization, device.public_key) : null;

    if ((decoded == undefined || decoded.identity !== req.params.dongleId)) {
        logger.info(`HTTP.DEVICES JWT authorization failed, token: ${req.headers.authorization} device: ${JSON.stringify(device)}, decoded: ${JSON.stringify(decoded)}`);
        return res.send('Unauthorized.').status(400)
    } 

    let response={'is_paired': (device.account_id>0 ? true : false), 'prime': (device.account_id>0 ? true : false)};
    logger.info("HTTP.DEVICES for " + req.params.dongleId + " returning: "+JSON.stringify(response));

    res.status(200);
    res.json(response);
}))


// RETURN STATS FOR DASHBOARD
router.get('/v1.1/devices/:dongleId/stats', runAsyncWrapper(async (req, res) => {
    const dongleId = req.params.dongleId;
    logger.info("HTTP.STATS called for " + req.params.dongleId + "");
    
    let stats = {
        all: {
            routes: 0,
            distance: 0,
            minutes: 0
        },
        week: {
            routes: 0,
            distance: 0,
            minutes: 0
        },
        
    };

    const device = await models.drivesModel.getDevice(dongleId);
    if (!device) {
        logger.info(`HTTP.STATS device ${dongleId} not found`);
        res.status(200);
        res.json(stats);
        return;
    }

    let decoded = device.public_key ? await controllers.authentication.validateJWT(req.headers.authorization, device.public_key) : null;

    if ((decoded == undefined || decoded.identity !== req.params.dongleId)) {
        logger.info(`HTTP.STATS JWT authorization failed, token: ${req.headers.authorization} device: ${JSON.stringify(device)}, decoded: ${JSON.stringify(decoded)}`);
        return res.send('Unauthorized.').status(400)
    }
    
    const statresult = await models.__db.get('SELECT COUNT(*) as routes, ROUND(SUM(distance_meters)/1609.34) as distance, ROUND(SUM(duration)/60) as duration FROM drives WHERE dongle_id=?', device.dongle_id)
    if (statresult != null && statresult.routes != null) {
        stats.all.routes = statresult.routes;
        stats.all.distance = statresult.distance!=null ? statresult.distance : 0;
        stats.all.minutes = statresult.duration!=null ? statresult.duration : 0;
    }

    // this determines the date at 00:00:00 UTC of last monday (== beginning of the current "ISO" week)
    let d = new Date();
    let day = d.getDay();
    let diff = d.getDate() - day + (day == 0 ? -6:1);
    let lastMonday = new Date(d.setDate(diff));
    lastMonday.setHours(0, 0, 0, 0);
    
    const statresultweek = await models.__db.get('SELECT COUNT(*) as routes, ROUND(SUM(distance_meters)/1609.34) as distance, ROUND(SUM(duration)/60) as duration FROM drives WHERE dongle_id=? AND drive_date >= ?', device.dongle_id, lastMonday.getTime())
    if (statresultweek != null && statresultweek.routes != null) {
        stats.week.routes = statresultweek.routes;
        stats.week.distance = statresultweek.distance!=null ? statresultweek.distance : 0;
        stats.week.minutes = statresultweek.duration!=null ? statresultweek.duration : 0;
    }

    logger.info("HTTP.STATS for " + req.params.dongleId + " returning: "+JSON.stringify(stats));

    res.status(200);
    res.json(stats);
}))


// RETURN USERNAME & POINTS FOR DASHBOARD
router.get('/v1/devices/:dongleId/owner', runAsyncWrapper(async (req, res) => {
    const dongleId = req.params.dongleId;
    logger.info("HTTP.OWNER called for " + req.params.dongleId + "");
    
    const device = await models.drivesModel.getDevice(dongleId);

    if (!device) {
        logger.info(`HTTP.OWNER device ${dongleId} not found`);
        let response={'username': 'unregisteredDevice', 'points': 0};
        res.status(200);
        return;
    }

    let decoded = device.public_key ? await controllers.authentication.validateJWT(req.headers.authorization, device.public_key) : null;

    if ((decoded == undefined || decoded.identity !== req.params.dongleId)) {
        logger.info(`HTTP.OWNER JWT authorization failed, token: ${req.headers.authorization} device: ${JSON.stringify(device)}, decoded: ${JSON.stringify(decoded)}`);
        return res.send('Unauthorized.').status(400)
    }

    let owner="";
    let points=0;

    const account = await models.__db.get('SELECT * FROM accounts WHERE id = ?', device.account_id);
    if (account != null) {
        owner = account.email.split("@")[0];
        const stats = await models.__db.all('SELECT SUM(distance_meters) as points FROM drives WHERE dongle_id IN (SELECT dongle_id FROM devices WHERE account_id=?)', account.id)
        if (stats != null && stats.points != null)
            points = stats.points;
    }

    let response={'username': owner, 'points': points};
    logger.info("HTTP.OWNER for " + req.params.dongleId + " returning: "+JSON.stringify(response));

    res.status(200);
    res.json(response);
}))


// DRIVE & BOOT/CRASH LOG FILE UPLOAD URL REQUEST
router.get('/v1.3/:dongleId/upload_url/', runAsyncWrapper(async (req, res) => {
    var path = req.query.path;
    const dongleId = req.params.dongleId;
    const auth = req.headers.authorization;
    logger.info("HTTP.UPLOAD_URL called for " + req.params.dongleId + " and file " + path + ": " + JSON.stringify(req.headers));


    const device = await models.drivesModel.getDevice(dongleId);


    if (!device) {
        logger.info(`HTTP.UPLOAD_URL device ${dongleId} not found or not linked to an account / refusing uploads`);
        return res.send('Unauthorized.').status(400)
    }

    let decoded = device.public_key ? await controllers.authentication.validateJWT(req.headers.authorization, device.public_key) : null;

    if ((decoded == undefined || decoded.identity !== req.params.dongleId)) {
        logger.info(`HTTP.UPLOAD_URL JWT authorization failed, token: ${auth} device: ${JSON.stringify(device)}, decoded: ${JSON.stringify(decoded)}`);
        return res.send('Unauthorized.').status(400)
    }

    await models.drivesModel.deviceCheckIn(dongleId)

    let responseUrl = null;
    const ts = Date.now(); // we use this to make sure old URLs cannot be reused (timeout after 60min)

    const dongleIdHash = crypto.createHmac('sha256', config.applicationSalt).update(dongleId).digest('hex');

    // boot log upload

    if (path.indexOf("boot/") === 0 || path.indexOf("crash/") === 0 || path.indexOf("bootlog.bz2")>0) {
        if (path.indexOf("bootlog.bz2")>0) { // pre-op 0.8 way of uploading bootlogs
            // file 2020-09-30--08-09-13--0/bootlog.bz2 to something like: boot/2021-05-11--03-03-38.bz2
            path=`boot/${path.split("--")[0]}--${path.split("--")[1]}.bz2`;
        }

        let filename = path.replace("/", "-");
        
        // TODO, allow multiple types
        let uploadType = path.indexOf("boot/") === 0 ? 'boot' : 'crash';

        // "boot-2021-04-12--01-45-30.bz" for example
        const directory = `${dongleId}/${dongleIdHash}/${uploadType}`;

        const token = crypto.createHmac('sha256', config.applicationSalt).update(dongleId + filename + directory + ts).digest('hex');

        responseUrl = `${config.baseUploadUrl}?file=${filename}&dir=${directory}&dongleId=${dongleId}&ts=${ts}&token=${token}`;
        logger.info(`HTTP.UPLOAD_URL matched '${uploadType}' file upload, constructed responseUrl: ${responseUrl}`);
    } else {
        // "2021-04-12--01-44-25--0/qlog.bz2" for example
        const subdirPosition = path.split("--", 2).join("--").length;
        const filenamePosition = path.indexOf("/");
        if (subdirPosition > 0 && filenamePosition > subdirPosition) {
            const driveName = `${path.split("--")[0]}--${path.split("--")[1]}`
            const segment = parseInt(path.split("--")[2].substr(0, path.split("--")[2].indexOf("/")));
            let directory = `${path.split("--")[0]}--${path.split("--")[1]}/${segment}`;
            const filename = path.split("/")[1];

            let validRequest = false;

            if ((filename === 'fcamera.hevc' || filename === 'qcamera.ts' || filename === 'dcamera.hevc' || filename === 'rlog.bz2' || filename === 'qlog.bz2') &&
                (!isNaN(segment) || (segment > 0 && segment < 1000))) {
                validRequest = true;
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

            const drive = await models.__db.get('SELECT * FROM drives WHERE identifier = ? AND dongle_id = ?', driveName, dongleId);

            if (drive == null) {
                // create a new drive
                const timeSplit = driveName.split('--');
                const timeString = timeSplit[0] + ' ' + timeSplit[1].replace(/-/g, ':');

                const driveResult = await models.__db.run(
                    'INSERT INTO drives (identifier, dongle_id, max_segment, duration, distance_meters, filesize, upload_complete, is_processed, drive_date, created, last_upload, is_preserved, is_deleted, is_physically_removed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    driveName, dongleId, segment, 0, 0, 0, false, false, Date.parse(timeString), Date.now(), Date.now(), false, false, false);


                const driveSegmentResult = await models.__db.run(
                    'INSERT INTO drive_segments (segment_id, drive_identifier, dongle_id, duration, distance_meters, upload_complete, is_processed, is_stalled, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    segment, driveName, dongleId, 0, 0, false, false, false, Date.now());

                logger.info("HTTP.UPLOAD_URL created new drive #" + JSON.stringify(driveResult.lastID));
            } else {
                const driveResult = await models.__db.run(
                    'UPDATE drives SET last_upload = ?, max_segment = ?, upload_complete = ?, is_processed = ?  WHERE identifier = ? AND dongle_id = ?',
                    Date.now(), Math.max(drive.max_segment, segment), false, false, driveName, dongleId
                );

                const drive_segment = await models.__db.get('SELECT * FROM drive_segments WHERE drive_identifier = ? AND dongle_id = ? AND segment_id = ?', driveName, dongleId, segment);

                if (drive_segment == null) {
                    const driveSegmentResult = await models.__db.run(
                        'INSERT INTO drive_segments (segment_id, drive_identifier, dongle_id, duration, distance_meters, upload_complete, is_processed, is_stalled, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                        segment, driveName, dongleId, 0, 0, false, false, false, Date.now()
                    );
                } else {
                    const driveSegmentResult = await models.__db.run(
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
}))


// DEVICE REGISTRATION OR RE-ACTIVATION
router.post('/v2/pilotauth/', bodyParser.urlencoded({extended: true}), async (req, res) => {
    var imei1 = req.query.imei;
    var serial = req.query.serial;
    var public_key = req.query.public_key;
    var register_token = req.query.register_token;

    if (imei1 == null || imei1.length < 5 || serial == null || serial.length < 5 || public_key == null || public_key.length < 5 || register_token == null || register_token.length < 5) {
        logger.error(`HTTP.V2.PILOTAUTH a required parameter is missing or empty ${JSON.stringify(req.query)}`);
        res.status(400);
        res.send('Malformed Request.');
        return;
    }
    var decoded = await controllers.authentication.validateJWT(req.query.register_token, public_key);


    if (decoded == null || decoded.register == undefined) {
        logger.error("HTTP.V2.PILOTAUTH JWT token is invalid (" + JSON.stringify(decoded) + ")");
        res.status(400);
        res.send('Malformed Request.');
        return;
    }

    const device = await models.__db.get('SELECT * FROM devices WHERE imei = ? AND serial = ?', imei1, serial);
    if (device == null) {
        logger.info("HTTP.V2.PILOTAUTH REGISTERING NEW DEVICE (" + imei1 + ", " + serial + ")");
        while (true) {
            var dongleId = crypto.randomBytes(4).toString('hex');
            const isDongleIdTaken = await models.__db.get('SELECT * FROM devices WHERE imei = ? AND serial = ?', imei1, serial);
            if (isDongleIdTaken == null) {
                const resultingDevice = await models.__db.run(
                    'INSERT INTO devices (dongle_id, account_id, imei, serial, device_type, public_key, created, last_ping, storage_used) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    dongleId, 0, imei1, serial, 'freon', public_key, Date.now(), Date.now(), 0);

                const device = await models.__db.get('SELECT * FROM devices WHERE dongle_id = ?', dongleId);

                logger.info("HTTP.V2.PILOTAUTH REGISTERED NEW DEVICE: " + JSON.stringify(device));
                res.status(200);
                res.json({dongle_id: device.dongle_id, access_token: 'DEPRECATED-BUT-REQUIRED-FOR-07'});
                return;
            }
        }
    } else {
        const result = await models.__db.run(
            'UPDATE devices SET last_ping = ?, public_key = ? WHERE dongle_id = ?',
            Date.now(), public_key, device.dongle_id
        );

        logger.info("HTTP.V2.PILOTAUTH REACTIVATING KNOWN DEVICE (" + imei1 + ", " + serial + ") with dongle_id " + device.dongle_id + "");
        res.status(200);
        res.json({dongle_id: device.dongle_id, access_token: 'DEPRECATED-BUT-REQUIRED-FOR-07'});
    }
})


// RETRIEVES DATASET FOR OUR MODIFIED CABANA - THIS RESPONSE IS USED TO FAKE A DEMO ROUTE
router.get('/useradmin/cabana_drive/:extendedRouteIdentifier', runAsyncWrapper(async (req, res) => {

    var params = req.params.extendedRouteIdentifier.split('|');
    var dongleId = params[0];
    var dongleIdHashReq = params[1];
    var driveIdentifier = params[2];
    var driveIdentifierHashReq = params[3];

    const drive = await models.__db.get('SELECT * FROM drives WHERE identifier = ? AND dongle_id = ?', driveIdentifier, dongleId);

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
}))



module.exports = (_models, _controllers, _logger) => {
    models = _models;
    controllers = _controllers;
    logger = _logger;

    return router;
}