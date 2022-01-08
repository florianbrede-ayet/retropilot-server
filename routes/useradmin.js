/* eslint-disable */
const router = require('express').Router();
const bodyParser = require('body-parser');
const crypto = require('crypto');
const htmlspecialchars = require('htmlspecialchars');
const dirTree = require('directory-tree');
const cookieParser = require('cookie-parser');
const config = require('../config');

// TODO Remove this, pending on removing all auth logic from routes
router.use(cookieParser());

function runAsyncWrapper(callback) {
  return function wrapper (req, res, next) {
    callback(req, res, next)
      .catch(next);
  };
}

let models;
let controllers;
let logger;

router.post('/useradmin/auth', bodyParser.urlencoded({ extended: true }), runAsyncWrapper(async (req, res) => {
  const signIn = await controllers.authentication.signIn(req.body.email, req.body.password);

  console.log(signIn);

  if (signIn.success) {
    res.cookie('jwt', signIn.jwt);
    res.redirect('/useradmin/overview');
  } else {
    res.redirect(`/useradmin?status=${encodeURIComponent('Invalid credentials or banned account')}`);
  }
}));

router.get('/useradmin/signout', runAsyncWrapper(async (req, res) => {
  res.clearCookie('session');
  res.clearCookie('jwt');
  res.redirect(`/useradmin?status=${encodeURIComponent('Signed out')}`);
}));

router.get('/useradmin', runAsyncWrapper(async (req, res) => {
  const account = await controllers.authentication.getAuthenticatedAccount(req, res);
  if (account != null) {
    res.redirect('/useradmin/overview');
    return;
  }

  const accounts = await models.__db.get('SELECT COUNT(*) AS num FROM accounts');
  const devices = await models.__db.get('SELECT COUNT(*) AS num FROM devices');
  const drives = await models.__db.get('SELECT COUNT(*) AS num, SUM(distance_meters) as distance, SUM(duration) as duration FROM drives');

  res.status(200);
  res.send(`<html style="font-family: monospace">
    <h2>Welcome To The RetroPilot Server Dashboard!</h2>
    <br><br>
    <h3>Login</h3>
    ${req.query.status !== undefined ? `<u>${htmlspecialchars(req.query.status)}</u><br>` : ''}
    <form action="/useradmin/auth" method="POST">
        <input type="email" name="email" placeholder="Email" required>
        <input type="password" name="password" placeholder="Password" required>
        <input type="submit">
    </form>
    <br><br>
    ${!config.allowAccountRegistration ? '<i>User Account Registration is disabled on this Server</i>' : '<a href="/useradmin/register">Register new Account</a>'}
    <br><br>
    Accounts: ${accounts.num}  |  
    Devices: ${devices.num}  |  
    Drives: ${drives.num}  |  
    Distance Traveled: ${Math.round(drives.distance / 1000)} km  |  
    Time Traveled: ${controllers.helpers.formatDuration(drives.duration)}  |  
    Storage Used: ${await controllers.storage.getTotalStorageUsed() !== null ? await controllers.storage.getTotalStorageUsed() : '--'}
    <br><br>${config.welcomeMessage}
</html>`);
}));

router.post('/useradmin/register/token', bodyParser.urlencoded({ extended: true }), runAsyncWrapper(async (req, res) => {
  if (!req.body.hasOwnProperty('email') || req.body.email === '') {
    res.status(400);
    res.send('Malformed Request');
    logger.warn('/useradmin/register/token - Malformed Request!');
    return;
  }

  const { email } = req.body;

  if (!config.allowAccountRegistration) {
    res.send('Unauthorized.').status(401);
    return;
  }

  const authAccount = await controllers.authentication.getAuthenticatedAccount(req, res);
  if (authAccount != null) {
    res.redirect('/useradmin/overview');
    return;
  }

  const account = await models.__db.get('SELECT * FROM accounts WHERE LOWER(email) = ?', email.trim().toLowerCase());
  if (account != null) {
    res.redirect(`/useradmin/register?status=${encodeURIComponent('Email is already registered')}`);
    return;
  }

  const token = crypto.createHmac('sha256', config.applicationSalt).update(email.trim()).digest('hex');

  let infoText = '';

  if (req.body.token === undefined) { // email entered, token request
    infoText = 'Please check your inbox (<b>SPAM</b>) for an email with the registration token.<br>If the token was not delivered, please ask the administrator to check the <i>server.log</i> for the token generated for your email.<br><br>';

    const emailStatus = await controllers.mailing.sendEmailVerification(token, email);
  } else { // final registration form filled
    if (req.body.token !== token) {
      infoText = 'The registration token you entered was incorrect, please try again.<br><br>';
    } else if (req.body.password !== req.body.password2 || req.body.password.length < 3) {
      infoText = 'The passwords you entered did not match or were shorter than 3 characters, please try again.<br><br>';
    } else {
      const result = await models.__db.run(
        'INSERT INTO accounts (email, password, created, banned) VALUES (?, ?, ?, ?)',
        email,
        crypto.createHash('sha256').update(req.body.password + config.applicationSalt).digest('hex'),
        Date.now(),
        false,
      );

      if (result.lastID) {
        logger.info(`USERADMIN REGISTRATION - created new account #${result.lastID} with email ${email}`);

        res.redirect(`/useradmin?status=${encodeURIComponent('Successfully registered')}`);
        return;
      }
      logger.error(`USERADMIN REGISTRATION - account creation failed, resulting account data for email ${email} is: ${result}`);
      infoText = 'Unable to complete account registration (database error).<br><br>';
    }
  }

  res.status(200);
  res.send(`<html style="font-family: monospace">
    <h2>Welcome To The RetroPilot Server Dashboard!</h2>
    <a href="/useradmin">< < < Back To Login</a>
    <br><br>
    <h3>Register / Finish Registration</h3>
    ${infoText}
    <form action="/useradmin/register/token" method="POST">
        <input type="email" name="email" placeholder="Email" value="${htmlspecialchars(email.trim())}"required>
        <input type="text" name="token" placeholder="Email Token" value="${req.body.token ? htmlspecialchars(req.body.token.trim()) : ''}" required><br>
        <input type="password" name="password" placeholder="Password"  value="${req.body.password ? htmlspecialchars(req.body.password.trim()) : ''}" required>
        <input type="password" name="password2" placeholder="Repeat Password"  value="${req.body.password2 ? htmlspecialchars(req.body.password2.trim()) : ''}" required>
        <input type="submit" value="Finish Registration">
    </form>
</html>`);
}));

router.get('/useradmin/register', runAsyncWrapper(async (req, res) => {
  if (!config.allowAccountRegistration) {
    res.status(400);
    res.send('Unauthorized.');
    return;
  }

  const account = await controllers.authentication.getAuthenticatedAccount(req, res);
  if (account != null) {
    res.redirect('/useradmin/overview');
    return;
  }

  res.status(200);
  res.send(`<html style="font-family: monospace">
    <h2>Welcome To The RetroPilot Server Dashboard!</h2>
    <a href="/useradmin">< < < Back To Login</a>
    <br><br>
    <h3>Register / Request Email Token</h3>
    ${req.query.status !== undefined ? `<u>${htmlspecialchars(req.query.status)}</u><br>` : ''}
    <form action="/useradmin/register/token" method="POST">
        <input type="email" name="email" placeholder="Email" required>
        <input type="submit" value="Verify Email">
    </form>
</html>`);
}));

router.get('/useradmin/overview', runAsyncWrapper(async (req, res) => {
  const account = await controllers.authentication.getAuthenticatedAccount(req, res);
  if (account == null) {
    res.redirect(`/useradmin?status=${encodeURIComponent('Invalid or expired session')}`);
    return;
  }

  const devices = await models.__db.all('SELECT * FROM devices WHERE account_id = ? ORDER BY dongle_id ASC', account.id);

  let response = `<html style="font-family: monospace">
    <h2>Welcome To The RetroPilot Server Dashboard!</h2>
    <br><br>
    <h3>Account Overview</h3>
    <b>Account:</b> #${account.id}<br>
    <b>Email:</b> ${account.email}<br>
    <b>Created:</b> ${controllers.helpers.formatDate(account.created)}<br><br>
    <b>Devices:</b><br>
    <table border=1 cellpadding=2 cellspacing=2>
        <tr><th>dongle_id</th><th>device_type</th><th>created</th><th>last_ping</th><th>storage_used</th></tr>
`;

  for (const i in devices) {
    response += `<tr>
    <td><a href="/useradmin/device/${devices[i].dongle_id}">${devices[i].dongle_id}</a></td>
    <td>${devices[i].device_type}</td>
    <td>${controllers.helpers.formatDate(devices[i].created)}</td>
    <td>${controllers.helpers.formatDate(devices[i].last_ping)}</td>
    <td>${devices[i].storage_used} MB</td>
</tr>`;
  }
  response += `</table>
<br>
<hr/>
<h3>Pair New Devices</h3>
<i>* To pair a new device, first have it auto-register on this server.<br>Then scan the QR Code and paste the Device Token below.</i><br>
${req.query.linkstatus !== undefined ? `<br><u>${htmlspecialchars(req.query.linkstatus)}</u><br><br>` : ''}
<form action="/useradmin/pair_device" method="POST">
<input type="text" name="qr_string" placeholder="QR Code Device Token" required>
<input type="submit" value="Pair">
</form>
<br><br>
<hr/>
<a href="/useradmin/signout">Sign Out</a>`;

  response += `<br>${config.welcomeMessage}</html>`;

  res.status(200);
  res.send(response);
}));

router.get('/useradmin/unpair_device/:dongleId', runAsyncWrapper(async (req, res) => {
  const account = await controllers.authentication.getAuthenticatedAccount(req, res);
  if (account == null) {
    res.redirect(`/useradmin?status=${encodeURIComponent('Invalid or expired session')}`);
    return;
  }

  res.redirect('/useradmin/overview');
}))

router.post('/useradmin/pair_device', bodyParser.urlencoded({ extended: true }), runAsyncWrapper(async (req, res) => {
  const account = await controllers.authentication.getAuthenticatedAccount(req, res);
  if (account == null) {
    res.redirect(`/useradmin?status=${encodeURIComponent('Invalid or expired session')}`);
    return;
  }

  const pairDevice = await controllers.devices.pairDevice(account, req.body.qr_string);

  if (pairDevice.success === true) {
    res.redirect('/useradmin/overview');
  } else if (pairDevice.registered === true) {
    res.redirect(`/useradmin/overview?linkstatus=${encodeURIComponent('Device not registered on Server')}`);
  } else if (pairDevice.badToken === true) {
    res.redirect(`/useradmin/overview?linkstatus=${encodeURIComponent('Device QR Token is invalid or has expired')}`);
  } else if (pairDevice.alreadyPaired) {
    res.redirect(`/useradmin/overview?linkstatus=${encodeURIComponent('Device is already paired, unpair in that account first')}`);
  } else if (pairDevice.badQr) {
    res.redirect(`/useradmin/overview?linkstatus=${encodeURIComponent('Bad QR')}`);
  } else {
    res.redirect(`/useradmin/overview?linkstatus=${encodeURIComponent(`Unspecified Error ${JSON.stringify(pairDevice)}`)}`);
  }
}));

router.get('/useradmin/device/:dongleId', runAsyncWrapper(async (req, res) => {
  const account = await controllers.authentication.getAuthenticatedAccount(req, res);
  if (account == null) {
    res.redirect(`/useradmin?status=${encodeURIComponent('Invalid or expired session')}`);
    return;
  }

  const device = await models.__db.get('SELECT * FROM devices WHERE account_id = ? AND dongle_id = ?', account.id, req.params.dongleId);

  if (device == null) {
    res.status(400);
    res.send('Unauthorized.');
    return;
  }

  const drives = await models.__db.all('SELECT * FROM drives WHERE dongle_id = ? AND is_deleted = ? ORDER BY created DESC', device.dongle_id, false);

  const dongleIdHash = crypto.createHmac('sha256', config.applicationSalt).update(device.dongle_id).digest('hex');

  const bootlogFiles = await controllers.devices.getBootlogs(device.dongle_id);
  const crashlogFiles = await controllers.devices.getCrashlogs(device.dongle_id);

  let response = `<html style="font-family: monospace">
    <h2>Welcome To The RetroPilot Server Dashboard!</h2>
    <a href="/useradmin/overview">< < < Back To Overview</a>
    <br><br>
    <h3>Device ${device.dongle_id}</h3>
    <b>Type:</b> ${device.device_type}<br>
    <b>Serial:</b> ${device.serial}<br>
    <b>IMEI:</b> ${device.imei}<br>
    <b>Registered:</b> ${controllers.helpers.formatDate(device.created)}<br>
    <b>Last Ping:</b> ${controllers.helpers.formatDate(device.last_ping)}<br>
    <b>Public Key:</b><br>
    <span style="font-size: 0.8em">${device.public_key.replace(/\r?\n|\r/g, '<br>')}</span><br>
    <b>Stored Drives:</b> ${drives.length}<br>
    <b>Quota Storage:</b> ${device.storage_used} MB / ${config.deviceStorageQuotaMb} MB<br>
    <br>`;

  response += `<b>Boot Logs (last 5):</b>
<br>
<table border=1 cellpadding=2 cellspacing=2>
    <tr><th>date</th><th>file</th><th>size</th></tr>
`;
  for (let i = 0; i < Math.min(5, bootlogFiles.length); i++) {
    response += `<tr><td>${controllers.helpers.formatDate(bootlogFiles[i].date)}</td><td><a href="${config.baseDriveDownloadUrl}${device.dongle_id}/${dongleIdHash}/boot/${bootlogFiles[i].name}" target=_blank>${bootlogFiles[i].name}</a></td><td>${bootlogFiles[i].size}</td></tr>`;
  }
  response += '</table><br><br>';

  response += `<b>Crash Logs (last 5):</b><br>
            <table border=1 cellpadding=2 cellspacing=2>
            <tr><th>date</th><th>file</th><th>size</th></tr>`;
  for (let i = 0; i < Math.min(5, crashlogFiles.length); i++) {
    response += `<tr>
    <td>${controllers.helpers.formatDate(crashlogFiles[i].date)}</td>.
    <td><a href="${config.baseDriveDownloadUrl}${device.dongle_id}/${dongleIdHash}/crash/${crashlogFiles[i].name}" target=_blank>${crashlogFiles[i].name}</a></td>
    <td>${crashlogFiles[i].size}</td>
</tr>`;
  }
  response += '</table><br><br>';

  response += `<b>Drives (non-preserved drives expire ${config.deviceDriveExpirationDays} days after upload):</b><br>
        <table border=1 cellpadding=2 cellspacing=2>
        <tr>
            <th>identifier</th>
            <th>car</th>
            <th>version</th>
            <th>filesize</th>
            <th>duration</th>
            <th>distance_meters</th>
            <th>upload_complete</th>
            <th>is_processed</th>
            <th>upload_date</th>
            <th>actions</th>
          </tr>`;

  for (const i in drives) {
    let vehicle = '';
    let version = '';
    let metadata = {};
    try {
      metadata = JSON.parse(drives[i].metadata);
      if (metadata.InitData && metadata.InitData.Version) {
        version = htmlspecialchars(metadata.InitData.Version);
      }
      if (metadata.CarParams) {
        if (metadata.CarParams.CarName) {
          vehicle += `${htmlspecialchars(metadata.CarParams.CarName.toUpperCase())} `;
        }
        if (metadata.CarParams.CarFingerprint) {
          vehicle += htmlspecialchars(metadata.CarParams.CarFingerprint.toUpperCase());
        }
      }
    } catch (exception) {}

    response += `<tr><td><a href="/useradmin/drive/${drives[i].dongle_id}/${drives[i].identifier}">${drives[i].is_preserved ? '<b>' : ''}${drives[i].identifier}${drives[i].is_preserved ? '</b>' : ''}</a></td><td>${vehicle}</td><td>${version}</td><td>${Math.round(drives[i].filesize / 1024)} MiB</td><td>${controllers.helpers.formatDuration(drives[i].duration)}</td><td>${Math.round(drives[i].distance_meters / 1000)} km</td><td>${drives[i].upload_complete}</td><td>${drives[i].is_processed}</td><td>${controllers.helpers.formatDate(drives[i].created)}</td><td>` + `[<a href="/useradmin/drive/${drives[i].dongle_id}/${drives[i].identifier}/delete" onclick="return confirm('Permanently delete this drive?')">delete</a>]${drives[i].is_preserved ? '' : `&nbsp;&nbsp;[<a href="/useradmin/drive/${drives[i].dongle_id}/${drives[i].identifier}/preserve">preserve</a>]`}</tr>`;
  }
  response += `    </table>
    <br>
    <hr/>
    <a href="/useradmin/unpair_device/${device.dongle_id}" onclick="return confirm('Are you sure that you want to unpair your device? Uploads will be rejected until it is paired again.')">Unpair Device</a>
    <br><br>
    <hr/>
    <a href="/useradmin/signout">Sign Out</a>
</html>`;

  res.status(200);
  res.send(response);
}));

router.get('/useradmin/drive/:dongleId/:driveIdentifier/:action', runAsyncWrapper(async (req, res) => {
  const account = await controllers.authentication.getAuthenticatedAccount(req, res);
  if (account == null) {
    res.redirect(`/useradmin?status=${encodeURIComponent('Invalid or expired session')}`);
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

  if (req.params.action === 'delete') {
    const result = await models.__db.run(
      'UPDATE drives SET is_deleted = ? WHERE id = ?',
      true,

      drive.id,
    );
  } else if (req.params.action === 'preserve') {
    const result = await models.__db.run(
      'UPDATE drives SET is_preserved = ? WHERE id = ?',
      true,

      drive.id,
    );
  }

  res.redirect(`/useradmin/device/${device.dongle_id}`);
}));

router.get('/useradmin/drive/:dongleId/:driveIdentifier', runAsyncWrapper(async (req, res) => {
  const account = await controllers.authentication.getAuthenticatedAccount(req, res);

  if (account == null) {
    res.redirect(`/useradmin?status=${encodeURIComponent('Invalid or expired session')}`);
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

  const dongleIdHash = crypto.createHmac('sha256', config.applicationSalt).update(device.dongle_id).digest('hex');
  const driveIdentifierHash = crypto.createHmac('sha256', config.applicationSalt).update(drive.identifier).digest('hex');

  const driveUrl = `${config.baseDriveDownloadUrl + device.dongle_id}/${dongleIdHash}/${driveIdentifierHash}/${drive.identifier}/`;

  let cabanaUrl = null;
  if (drive.is_processed) {
    cabanaUrl = `${config.cabanaUrl}?retropilotIdentifier=${device.dongle_id}|${dongleIdHash}|${drive.identifier}|${driveIdentifierHash}&retropilotHost=${encodeURIComponent(config.baseUrl)}&demo=1"`;
  }

  let vehicle = '';
  let version = '';
  let gitRemote = '';
  let gitBranch = '';
  let gitCommit = '';
  let metadata = {};
  try {
    metadata = JSON.parse(drive.metadata);
    if (metadata.InitData) {
      if (metadata.InitData.Version) {
        version = htmlspecialchars(metadata.InitData.Version);
      }
      if (metadata.InitData.GitRemote) {
        gitRemote = htmlspecialchars(metadata.InitData.GitRemote);
      }
      if (metadata.InitData.GitBranch) {
        gitBranch = htmlspecialchars(metadata.InitData.GitBranch);
      }
      if (metadata.InitData.GitCommit) {
        gitCommit = htmlspecialchars(metadata.InitData.GitCommit);
      }
    }

    if (metadata.CarParams) {
      if (metadata.CarParams.CarName) {
        vehicle += `${htmlspecialchars(metadata.CarParams.CarName.toUpperCase())} `;
      }
      if (metadata.CarParams.CarFingerprint) {
        vehicle += htmlspecialchars(metadata.CarParams.CarFingerprint.toUpperCase());
      }
    }
  } catch (exception) {}

  const directoryTree = dirTree(`${config.storagePath + device.dongle_id}/${dongleIdHash}/${driveIdentifierHash}/${drive.identifier}`);

  let response = `<html style="font-family: monospace">
    <head>
        <link href="https://vjs.zencdn.net/7.11.4/video-js.css" rel="stylesheet" />
        <script src="https://vjs.zencdn.net/7.11.4/video.min.js"></script>
        <style>
            .video-js .vjs-current-time,
            .vjs-no-flex .vjs-current-time {
              display: block;
            }
            .vjs-default-skin.vjs-paused .vjs-big-play-button {display: none;}
        </style>
    </head>
    <body>
        <h2>Welcome To The RetroPilot Server Dashboard!</h2>
        <a href="/useradmin/device/${device.dongle_id}">< < < Back To Device ${device.dongle_id}</a>
        <br><br><h3>Drive ${drive.identifier} on ${drive.dongle_id}</h3>
        <b>Drive Date:</b> ${controllers.helpers.formatDate(drive.drive_date)}<br>
        <b>Upload Date:</b> ${controllers.helpers.formatDate(drive.created)}<br><br>
        <b>Vehicle:</b> ${vehicle}<br>
        <b>Openpilot Version:</b> ${version}<br><br>
        <b>GIT Remote:</b> ${gitRemote}<br>
        <b>GIT Branch:</b> ${gitBranch}<br>
        <b>GIT Commit:</b> ${gitCommit}<br><br>
        <b>Num Segments:</b> ${drive.max_segment + 1}<br>
        <b>Storage:</b> ${Math.round(drive.filesize / 1024)} MiB<br>
        <b>Duration:</b> ${controllers.helpers.formatDuration(drive.duration)}<br>
        <b>Distance:</b> ${Math.round(drive.distance_meters / 1000)} km<br>
        <b>Is Preserved:</b> ${drive.is_preserved}<br>
        <b>Upload Complete:</b> ${drive.upload_complete}<br>
        <b>Processed:</b> ${drive.is_processed}<br>
        <br>
        <b>Car Parameters:</b>
        <a id="show-button" href="#" onclick="
            document.getElementById('hide-button').style.display = 'inline';
            document.getElementById('show-button').style.display = 'none';
            document.getElementById('car-parameter-div').style.display = 'block'; 
            return false;">Show</a>
        <a id="hide-button" style="display: none;" href="#" onclick="
            document.getElementById('hide-button').style.display = 'none';
            document.getElementById('show-button').style.display = 'inline';
            document.getElementById('car-parameter-div').style.display = 'none'; 
            return false;">Hide</a>
            
            <br><pre id="car-parameter-div" style="display: none; font-size: 0.8em">${JSON.stringify(metadata && metadata.CarParams || {}, null, 2).replace(/\r?\n|\r/g, '<br>')}</pre>
        <br>

        <b>Preview <span id="current_preview_segment"></span>:</b>
        ${cabanaUrl ? `
                    <video id="drive_preview" class="video-js vjs-default-skin" controls width="480" height="386">
                        <source src="${driveUrl}/qcamera.m3u8" type='application/x-mpegURL'>
                    </video>
                    <script>
                    const player = videojs('drive_preview', {
                        "controls": true,
                        "autoplay": false,
                        "preload": "auto",
                        "controlBar": {
                            "remainingTimeDisplay": false
                        }
                    });
                    player.on('timeupdate', function () {
                        const segment = get_current_segment_info(this);
                        document.getElementById('current_preview_segment').textContent='(Segment: '+segment[0]+' | '+segment[1]+'% - Timestamp: '+segment[2]+')';
                    });

                    function get_current_segment_info(obj, old_segment = null) {
                        const target_media = obj.tech().vhs.playlists.media();
                        if (!target_media) {
                            return [0, 0, 0];
                        }
                        let snapshot_time = obj.currentTime();
                        let segment;
                        let segment_time;
                        for (let i = 0, l = target_media.segments.length; i < l; i++) {
                            if (snapshot_time < target_media.segments[i].end) {
                                segment = target_media.segments[i];
                                break;
                            }
                        }

                        if (segment) {
                            segment_time = Math.max(0, snapshot_time - (segment.end - segment.duration));
                        } else {
                            segment = target_media.segments[0];
                            segment_time = 0;
                        }
                        if (segment) {
                            const uri_arr = segment.uri.split("/");
                            return [uri_arr[uri_arr.length-2], Math.round(100/segment.duration*segment_time), Math.round(snapshot_time)];
                        }
                        return [0, 0, Math.round(snapshot_time)];
                    }

                    </script>
                ` : '(available after processing)'}
        <br>
        ${cabanaUrl ? `<a href="${cabanaUrl}" target=_blank><b>View Drive in CABANA</b></a>` : 'View Drive in CABANA'}
        <br><br>
        <b>Files:</b><br>
        <table border=1 cellpadding=2 cellspacing=2>
            <tr><th>segment</th><th>qcamera</th><th>qlog</th><th>fcamera</th><th>rlog</th><th>dcamera</th><th>processed</th><th>stalled</th></tr>`;

  const directorySegments = {};
  for (const i in directoryTree.children) {
    // skip any non-directory entries (for example m3u8 file in the drive directory)
    if (directoryTree.children[i].type !== 'directory') continue;

    const segment = directoryTree.children[i].name;

    let qcamera = '--';
    let fcamera = '--';
    let dcamera = '--';
    let qlog = '--';
    let rlog = '--';
    for (const c in directoryTree.children[i].children) {
      if (directoryTree.children[i].children[c].name === 'fcamera.hevc') fcamera = `<a target="_blank" href="${driveUrl}${segment}/${directoryTree.children[i].children[c].name}">${directoryTree.children[i].children[c].name}</a>`;
      if (directoryTree.children[i].children[c].name === 'dcamera.hevc') dcamera = `<a target="_blank" href="${driveUrl}${segment}/${directoryTree.children[i].children[c].name}">${directoryTree.children[i].children[c].name}</a>`;
      if (directoryTree.children[i].children[c].name === 'qcamera.ts') qcamera = `<a target="_blank" href="${driveUrl}${segment}/${directoryTree.children[i].children[c].name}">${directoryTree.children[i].children[c].name}</a>`;
      if (directoryTree.children[i].children[c].name === 'qlog.bz2') qlog = `<a target="_blank" href="${driveUrl}${segment}/${directoryTree.children[i].children[c].name}">${directoryTree.children[i].children[c].name}</a>`;
      if (directoryTree.children[i].children[c].name === 'rlog.bz2') rlog = `<a target="_blank" href="${driveUrl}${segment}/${directoryTree.children[i].children[c].name}">${directoryTree.children[i].children[c].name}</a>`;
    }

    let isProcessed = '?';
    let isStalled = '?';

    const drive_segment = await models.__db.get(
      'SELECT * FROM drive_segments WHERE segment_id = ? AND drive_identifier = ? AND dongle_id = ?',
      parseInt(segment, 10),
      drive.identifier,
      device.dongle_id,
    );

    if (drive_segment) {
      isProcessed = drive_segment.is_processed;
      isStalled = drive_segment.is_stalled;
    }

    directorySegments[`seg-${segment}`] = `<tr><td>${segment}</td><td>${qcamera}</td><td>${qlog}</td><td>${fcamera}</td><td>${rlog}</td><td>${dcamera}</td><td>${isProcessed}</td><td>${isStalled}</td></tr>`;
  }

  for (let i = 0; i <= drive.max_segment; i++) {
    if (!directorySegments[`seg-${i}`]) {
      const qcamera = '--';
      const fcamera = '--';
      const dcamera = '--';
      const qlog = '--';
      const rlog = '--';
      const isProcessed = '?';
      const isStalled = '?';
      response += `<tr><td>${i}</td><td>${qcamera}</td><td>${qlog}</td><td>${fcamera}</td><td>${rlog}</td><td>${dcamera}</td><td>${isProcessed}</td><td>${isStalled}</td></tr>`;
    } else {
      response += directorySegments[`seg-${i}`];
    }
  }

  response += `</table>
                <br><br>
                <hr/>
                <a href="/useradmin/signout">Sign Out</a></body></html>`;

  res.status(200);
  res.send(response);
}));

module.exports = (_models, _controllers, _logger) => {
  models = _models;
  controllers = _controllers;
  logger = _logger;

  return router;
};
