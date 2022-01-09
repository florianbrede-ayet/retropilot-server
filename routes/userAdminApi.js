/* eslint-disable max-len */
const router = require('express').Router();
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const config = require('../config');

// TODO Remove this, pending on removing all auth logic from routes
router.use(cookieParser());

function runAsyncWrapper(callback) {
  return function wrapper(req, res, next) {
    callback(req, res, next)
      .catch(next);
  };
}

/* eslint-disable no-unused-vars */
let models;
let controllers;
let logger;
/* eslint-enable no-unused-vars */

router.post('/retropilot/0/useradmin/auth', bodyParser.urlencoded({ extended: true }), runAsyncWrapper(async (req, res) => {
  const signIn = await controllers.authentication.signIn(req.body.email, req.body.password);
  if (!signIn.success) {
    return res.redirect(`/useradmin?status=${encodeURIComponent('Invalid credentials or banned account')}`);
  }

  return res.cookie('jwt', signIn.jwt).redirect('/useradmin/overview');
}));

router.get('/retropilot/0/useradmin/signout', runAsyncWrapper(async (req, res) => {
  res.clearCookie('session');
  return res.json({ success: true });
}));

router.get('/retropilot/0/useradmin', runAsyncWrapper(async (req, res) => {
  const accounts = await models.__db.get('SELECT COUNT(*) AS num FROM accounts');
  const devices = await models.__db.get('SELECT COUNT(*) AS num FROM devices');
  const drives = await models.__db.get('SELECT COUNT(*) AS num FROM drives');

  return res.status(200).send({
    success: true,
    data: {
      serverStats: {
        config: {
          registerAllowed: config.allowAccountRegistration,
          welcomeMessage: config.welcomeMessage,
        },
        accounts: accounts.num,
        devices: devices.num,
        drives: drives.num,
        storageUsed: await controllers.storage.getTotalStorageUsed(),
      },
    },
  });
}));

/*
    Requires username and password to register
 */

/*
router.post('/useradmin/register/token', bodyParser.urlencoded({extended: true}), runAsyncWrapper(async (req, res) => {
    const email = req.body.email;

    if (!config.allowAccountRegistration) {
        res.send('Unauthorized.').status(401);
        return;
    }

    const authAccount = await controllers.authentication.getAuthenticatedAccount(req);
    if (authAccount != null) {
        res.redirect('/useradmin/overview');
        return;
    }

    const account = await models.__db.get('SELECT * FROM accounts WHERE LOWER(email) = ?', email.trim().toLowerCase());
    if (account != null) {
        res.redirect('/useradmin/register?status=' + encodeURIComponent('Email is already registered'));
        return;
    }

    const token = crypto.createHmac('sha256', config.applicationSalt).update(email.trim()).digest('hex');

    let infoText = '';

    if (req.body.token === undefined) { // email entered, token request
        infoText = 'Please check your inbox (<b>SPAM</b>) for an email with the registration token.<br>If the token was not delivered, please ask the administrator to check the <i>server.log</i> for the token generated for your email.<br><br>';

        const emailStatus = await controllers.mailing.sendEmailVerification(token, email);

    } else { // final registration form filled
        if (req.body.token != token) {
            infoText = 'The registration token you entered was incorrect, please try again.<br><br>';
        } else if (req.body.password != req.body.password2 || req.body.password.length < 3) {
            infoText = 'The passwords you entered did not or were shorter than 3 characters, please try again.<br><br>';
        } else {

            const result = await models.__db.run(
                'INSERT INTO accounts (email, password, created, banned) VALUES (?, ?, ?, ?)',
                email,
                crypto.createHash('sha256').update(req.body.password + config.applicationSalt).digest('hex'),
                Date.now(), false);

            if (result.lastID != undefined) {
                logger.info("USERADMIN REGISTRATION - created new account #" + result.lastID + " with email " + email + "");
                res.cookie('session', {
                    account: email,
                    expires: Date.now() + 1000 * 3600 * 24 * 365
                }, {signed: true});
                res.redirect('/useradmin/overview');
                return;
            } else {
                logger.error("USERADMIN REGISTRATION - account creation failed, resulting account data for email " + email + " is: " + result);
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
                <input type="email" name="email" placeholder="Email" value="` + htmlspecialchars(email.trim()) + `"required>
                <input type="text" name="token" placeholder="Email Token" value="` + (req.body.token != undefined ? htmlspecialchars(req.body.token.trim()) : '') + `" required><br>
                <input type="password" name="password" placeholder="Password"  value="` + (req.body.password != undefined ? htmlspecialchars(req.body.password.trim()) : '') + `" required>
                <input type="password" name="password2" placeholder="Repeat Password"  value="` + (req.body.password2 != undefined ? htmlspecialchars(req.body.password2.trim()) : '') + `" required>
                <input type="submit" value="Finish Registration">
                </html>`);
}))

router.get('/useradmin/register', runAsyncWrapper(async (req, res) => {
    if (!config.allowAccountRegistration) {
        res.status(400);
        res.send('Unauthorized.');
        return;
    }

    const account = await controllers.authentication.getAuthenticatedAccount(req);
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
}))
*/

router.get('/retropilot/0/overview', runAsyncWrapper(async (req, res) => {
  const account = await controllers.authentication.getAuthenticatedAccount(req);
  if (account == null) {
    res.send({ success: false, data: { session: false } });

    return;
  }

  const devices = await models.__db.all('SELECT * FROM devices WHERE account_id = ? ORDER BY dongle_id ASC', account.id);

  // TODO implement a _safe_ get account for these use cases to allow for data to be stripped prior to sending to the client.
  delete (account.email_verify_token);
  res.json({
    success: true,
    data: {
      account,
      devices,
    },

  }).status(200);
}));

router.get('/retropilot/0/unpair_device/:dongleId', runAsyncWrapper(async (req, res) => {
  const account = await controllers.authentication.getAuthenticatedAccount(req);
  if (account == null) {
    return res.json({ success: false, data: { session: false } }).status(403);
  }

  const device = await models.__db.get('SELECT * FROM devices WHERE account_id = ? AND dongle_id = ?', account.id, req.params.dongleId);

  if (device == null) {
    return res.json({ success: false }).status(400);
  }

  await models.__db.run(
    'UPDATE devices SET account_id = ? WHERE dongle_id = ?',
    0,
    req.params.dongleId,
  );

  return res.json({ success: true, data: { unlink: true } });
}));

router.post('/retropilot/0/pair_device', bodyParser.urlencoded({ extended: true }), runAsyncWrapper(async (req, res) => {
  const account = await controllers.authentication.getAuthenticatedAccount(req);
  if (account == null) {
    return res.json({ success: false, msg: 'UNAUTHORISED', status: 403 });
  }

  const { qr_string: qrString } = req.body;
  if (!qrString) {
    return res.json({ success: false, msg: 'BAD_REQUEST', status: 400 });
  }

  const pairDevice = await controllers.devices.pairDevice(account, qrString);
  if (!pairDevice.success) {
    return res.json({ success: false, msg: 'error', data: pairDevice });
  }

  return res.json({
    success: true,
    msg: 'Paired',
    status: 200,
    data: pairDevice,
  });
}));

router.post('/retropilot/0/password/change', bodyParser.urlencoded({ extended: true }), runAsyncWrapper(async (req, res) => {
  const account = await controllers.authentication.getAuthenticatedAccount(req);
  if (account == null) {
    return res.json({ success: false, msg: 'UNAUTHORISED', status: 403 });
  }

  const pwChange = await controllers.authentication.changePassword(account, req.body.newPassword, req.body.oldPassword);
  if (!pwChange.success) {
    return res.json({ success: false, data: pwChange });
  }

  return res.json({ success: true });
}));

/*

router.get('/useradmin/device/:dongleId', runAsyncWrapper(async (req, res) => {
    const account = await controllers.authentication.getAuthenticatedAccount(req);
    if (account == null) {
        res.redirect('/useradmin?status=' + encodeURIComponent('Invalid or expired session'));
        return;
    }

    const device = await models.__db.get('SELECT * FROM devices WHERE account_id = ? AND dongle_id = ?', account.id, req.params.dongleId);

    if (device == null) {
        res.status(400);
        res.send('Unauthorized.');
        return;
    }

    const drives = await models.__db.all('SELECT * FROM drives WHERE dongle_id = ? AND is_deleted = ? ORDER BY created DESC', device.dongle_id, false);

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
                <b>Registered:</b> ` + controllers.helpers.formatDate(device.created) + `<br>
                <b>Last Ping:</b> ` + controllers.helpers.formatDate(device.last_ping) + `<br>
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
        response += `<tr><td>` + controllers.helpers.formatDate(bootlogFiles[i].date) + `</td><td><a href="` + config.baseDriveDownloadUrl + device.dongle_id + "/" + dongleIdHash + "/boot/" + bootlogFiles[i].name + `" target=_blank>` + bootlogFiles[i].name + `</a></td><td>` + bootlogFiles[i].size + `</td></tr>`;
    }
    response += `</table><br><br>`;

    response += `<b>Crash Logs (last 5):</b><br>
            <table border=1 cellpadding=2 cellspacing=2>
            <tr><th>date</th><th>file</th><th>size</th></tr>
        `;
    for (var i = 0; i < Math.min(5, crashlogFiles.length); i++) {
        response += `<tr><td>` + controllers.helpers.formatDate(crashlogFiles[i].date) + `</td><td><a href="` + config.baseDriveDownloadUrl + device.dongle_id + "/" + dongleIdHash + "/crash/" + crashlogFiles[i].name + `" target=_blank>` + crashlogFiles[i].name + `</a></td><td>` + crashlogFiles[i].size + `</td></tr>`;
    }
    response += `</table><br><br>`;

    response += `<b>Drives (non-preserved drives expire ` + config.deviceDriveExpirationDays + ` days after upload):</b><br>
        <table border=1 cellpadding=2 cellspacing=2>
        <tr><th>identifier</th><th>filesize</th><th>duration</th><th>distance_meters</th><th>upload_complete</th><th>is_processed</th><th>upload_date</th><th>actions</th></tr>
    `;

    for (var i in drives) {
        response += '<tr><td><a href="/useradmin/drive/' + drives[i].dongle_id + '/' + drives[i].identifier + '">' + (drives[i].is_preserved ? '<b>' : '') + drives[i].identifier + (drives[i].is_preserved ? '</b>' : '') + '</a></td><td>' + Math.round(drives[i].filesize / 1024) + ' MiB</td><td>' + controllers.helpers.formatDuration(drives[i].duration) + '</td><td>' + Math.round(drives[i].distance_meters / 1000) + ' km</td><td>' + drives[i].upload_complete + '</td><td>' + drives[i].is_processed + '</td><td>' + controllers.helpers.formatDate(drives[i].created) + '</td><td>' + '[<a href="/useradmin/drive/' + drives[i].dongle_id + '/' + drives[i].identifier + '/delete" onclick="return confirm(\'Permanently delete this drive?\')">delete</a>]' + (drives[i].is_preserved ? '' : '&nbsp;&nbsp;[<a href="/useradmin/drive/' + drives[i].dongle_id + '/' + drives[i].identifier + '/preserve">preserve</a>]') + '</tr>';
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

}))

router.get('/useradmin/drive/:dongleId/:driveIdentifier/:action', runAsyncWrapper(async (req, res) => {
    const account = await controllers.authentication.getAuthenticatedAccount(req);
    if (account == null) {
        res.redirect('/useradmin?status=' + encodeURIComponent('Invalid or expired session'));
        return;
    }

    const device = await models.__db.get('SELECT * FROM devices WHERE account_id = ? AND dongle_id = ?', account.id, req.params.dongleId);

    if (device == null) {
        res.status(400);
        res.send('Unauthorized.');
        return;
    }

    const drive = await models.__db.get('SELECT * FROM drives WHERE identifier = ? AND dongle_id = ?', req.params.driveIdentifier, req.params.dongleId);

    if (drive == null) {
        res.status(400);
        res.send('Unauthorized.');
        return;
    }

    if (req.params.action == 'delete') {
        const result = await models.__db.run(
            'UPDATE drives SET is_deleted = ? WHERE id = ?',
            true, drive.id
        );
    } else if (req.params.action == 'preserve') {
        const result = await models.__db.run(
            'UPDATE drives SET is_preserved = ? WHERE id = ?',
            true, drive.id
        );
    }

    res.redirect('/useradmin/device/' + device.dongle_id);

}))

router.get('/useradmin/drive/:dongleId/:driveIdentifier', runAsyncWrapper(async (req, res) => {
    const account = await controllers.authentication.getAuthenticatedAccount(req);

    if (account == null) {
        res.redirect('/useradmin?status=' + encodeURIComponent('Invalid or expired session'));
        return;
    }

    const device = await models.__db.get('SELECT * FROM devices WHERE account_id = ? AND dongle_id = ?', account.id, req.params.dongleId);

    if (device == null) {
        res.status(400);
        res.send('Unauthorized.');
        return;
    }

    const drive = await models.__db.get('SELECT * FROM drives WHERE identifier = ? AND dongle_id = ?', req.params.driveIdentifier, req.params.dongleId);

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
                <b>Drive Date:</b> ` + controllers.helpers.formatDate(drive.drive_date) + `<br>
                <b>Upload Date:</b> ` + controllers.helpers.formatDate(drive.created) + `<br>
                <b>Num Segments:</b> ` + (drive.max_segment + 1) + `<br>
                <b>Storage:</b> ` + Math.round(drive.filesize / 1024) + ` MiB<br>
                <b>Duration:</b> ` + controllers.helpers.formatDuration(drive.duration) + `<br>
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
        if (directoryTree.children[i].type !== 'directory') continue;

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

        const drive_segment = await models.__db.get('SELECT * FROM drive_segments WHERE segment_id = ? AND drive_identifier = ? AND dongle_id = ?', parseInt(segment), drive.identifier, device.dongle_id);

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

}))
*/

module.exports = (_models, _controllers, _logger) => {
  models = _models;
  controllers = _controllers;
  logger = _logger;

  return router;
};
