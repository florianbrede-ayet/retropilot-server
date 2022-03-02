import express from 'express';
import crypto from 'crypto';
import dirTree from 'directory-tree';
import bodyParser from 'body-parser';
import deviceSchema from '../../schema/routes/devices';

import deviceController from '../../controllers/devices';
import authenticationController from '../../controllers/authentication';
const router = express.Router();
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

/*
{
	version: "1.0"
	2fa: {
		tokenProvided: false,
		token: 000000
		unixTime: 00000
	},
	modifications: {
		nicname: x
		publicKey: x
	}
}

*/

router.put('/retropilot/0/device/:dongle_id/', [isAuthenticated, bodyParser.json()], async (req, res) => {
  if (!req.account) {
    return res.json({ success: false, msg: 'NOT_AUTHENTICATED' });
  }

  const { body } = req;
  console.log(deviceSchema.MutateDevice.isValid(body));
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
  const dongleIdHash = crypto.createHmac('sha256', process.env.APP_SALT).update(req.params.dongle_id).digest('hex');
  const driveIdentifierHash = crypto.createHmac('sha256', process.env.APP_SALT).update(req.params.drive_identifier).digest('hex');

  const directoryTree = dirTree(`${process.env.STORAGE_PATH + req.params.dongle_id}/${dongleIdHash}/${driveIdentifierHash}/${req.params.drive_identifier}`);

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

  const crashlogs = await deviceController.getCrashlogs(req.params.dongle_id);

  return res.json({ success: true, data: crashlogs });
});

export default router;
