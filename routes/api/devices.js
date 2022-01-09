const router = require('express').Router();
const crypto = require('crypto');
const dirTree = require('directory-tree');
const config = require('../../config');

/* eslint-disable no-unused-vars */
const userController = require('../../controllers/users');
const deviceController = require('../../controllers/devices');
const authenticationController = require('../../controllers/authentication');
/* eslint-enable no-unused-vars */

async function isAuthenticated(req, res, next) {
  const account = await authenticationController.getAuthenticatedAccount(req);

  if (account === null) {
    res.json({ success: false, msg: 'NOT_AUTHENTICATED1' });
  } else {
    req.account = account;
    next();
  }
}

router.get('/retropilot/0/devices', isAuthenticated, async (req, res) => {
  if (!req.account) {
    return res.json({ success: false, msg: 'NOT_AUTHENTICATED' });
  }

  const dongles = await deviceController.getDevices(req.account.id);

  return res.json({ success: true, data: dongles });
});

router.get('/retropilot/0/device/:dongle_id/drives/:drive_identifier/segment', isAuthenticated, async (req, res) => {
  if (!req.account) {
    return res.json({ success: false, msg: 'NOT_AUTHENTICATED' });
  }
  const dongleId = req.params.dongle_id;
  const accountId = req.account.id;
  const isUserAuthorised = await deviceController.isUserAuthorised(dongleId, accountId);

  // TODO reduce data returned`
  if (isUserAuthorised.success === false || isUserAuthorised.data.authorised === false) {
    return res.json({ success: false, msg: isUserAuthorised.msg });
  }
  const dongleIdHash = crypto.createHmac('sha256', config.applicationSalt).update(req.params.dongle_id).digest('hex');
  const driveIdentifierHash = crypto.createHmac('sha256', config.applicationSalt).update(req.params.drive_identifier).digest('hex');

  const directoryTree = dirTree(`${config.storagePath + req.params.dongle_id}/${dongleIdHash}/${driveIdentifierHash}/${req.params.drive_identifier}`);

  return res.json({ success: true, msg: 'ok', data: directoryTree });
});

router.get('/retropilot/0/device/:dongle_id/drives/:deleted', isAuthenticated, async (req, res) => {
  if (!req.account) {
    return res.json({ success: false, msg: 'NOT_AUTHENTICATED' });
  }
  const dongleId = req.params.dongle_id;
  const accountId = req.account.id;
  const isUserAuthorised = await deviceController.isUserAuthorised(dongleId, accountId);

  // TODO reduce data returned`
  if (isUserAuthorised.success === false || isUserAuthorised.data.authorised === false) {
    return res.json({ success: false, msg: isUserAuthorised.msg });
  }

  const dongles = await deviceController.getDrives(req.params.dongle_id, req.params.deleted === 'true', true);

  return res.json({ success: true, data: dongles });
});

router.get('/retropilot/0/device/:dongle_id/bootlogs', isAuthenticated, async (req, res) => {
  if (!req.account) {
    return res.json({ success: false, msg: 'NOT_AUTHENTICATED' });
  }
  const dongleId = req.params.dongle_id;
  const accountId = req.account.id;
  const isUserAuthorised = await deviceController.isUserAuthorised(dongleId, accountId);
  // TODO reduce data returned`
  if (isUserAuthorised.success === false || isUserAuthorised.data.authorised === false) {
    return res.json({ success: false, msg: isUserAuthorised.msg });
  }

  const bootlogs = await deviceController.getBootlogs(req.params.dongle_id);

  return res.json({ success: true, data: bootlogs });
});

router.get('/retropilot/0/device/:dongle_id/crashlogs', isAuthenticated, async (req, res) => {
  if (!req.account) {
    return res.json({ success: false, msg: 'NOT_AUTHENTICATED' });
  }
  const dongleId = req.params.dongle_id;
  const accountId = req.account.id;
  const isUserAuthorised = await deviceController.isUserAuthorised(dongleId, accountId);
  // TODO reduce data returned`
  if (isUserAuthorised.success === false || isUserAuthorised.data.authorised === false) {
    return res.json({ success: false, msg: isUserAuthorised.msg });
  }

  const bootlogs = await deviceController.getCrashlogs(req.params.dongle_id);

  return res.json({ success: true, data: bootlogs });
});

module.exports = router;
