const router = require('express').Router();

function runAsyncWrapper(callback) {
  return function (req, res, next) {
    callback(req, res, next)
      .catch(next);
  };
}

let models;
let controllers;
let logger;

// probs should put middleware somewhere else
router.use(async (req, res, next) => {
  const currentAdmin = await controllers.admin.isCurrentUserAdmin(true, req);
  if (currentAdmin.isAdmin === false) {
    return res.status(402).json({ error: true, msg: 'NOT AUTHORISED', status: 403 }).end();
  }
  next();
});

// TODO

router.get('/user/:userId/ban/:ban', runAsyncWrapper(async (req, res) => {
  const banResult = await controllers.admin.banAccount(req.params.ban, req.params.userId);
  if (banResult.hasOwnProperty('success') && banResult.success === true) {
    res.status(200).json(banResult);
  } else {
    res.status(500).json(banResult);
  }
}));

router.get('/user/:userId/get/devices', runAsyncWrapper(async (req, res) => {
  if (!req.params.userId) { return req.status(400).json({ error: true, msg: 'MISSING DATA', status: 400 }); }

  return res.status(200).json({ success: true, data: controllers.devices.getDevices(req.params.userId) });
}));

router.get('/user/', runAsyncWrapper(async (req, res) => {
  console.warn('PROCESSED');

  return res.status(200).json({ success: true, data: await controllers.users.getAllUsers() });
}));

router.get('/device/:dongle_id', runAsyncWrapper(async (req, res) => {
  if (!req.params.dongle_id) { return req.status(400).json({ error: true, msg: 'MISSING DATA', status: 400 }); }

  return res.status(200).json({ success: true, data: await controllers.devices.getDeviceFromDongle(req.params.dongle_id) });
}));

router.get('/device/:dongle_id/pair/:user_id', runAsyncWrapper(async (req, res) => {
  if (!req.params.dongle_id || !req.params.user_id) { return req.status(400).json({ error: true, msg: 'MISSING DATA', status: 400 }); }

  const pairDeviceToAccountId = await controllers.devices.pairDeviceToAccountId(req.params.dongle_id, req.params.user_id);

  return res.status(200).json(pairDeviceToAccountId);
}));

router.get('/device', runAsyncWrapper(async (req, res) => {
  const filteredDevices = await controllers.devices.getAllDevicesFiltered();
  console.log('fil', filteredDevices);
  return res.status(200).json({ success: true, data: filteredDevices });
}));

router.get('/device/:dongle_id/ignore/:ignore_uploads', runAsyncWrapper(async (req, res) => {
  if (!req.params.dongle_id || !req.params.ignore_uploads) { return req.status(400).json({ error: true, msg: 'MISSING DATA', status: 400 }); }
}));

router.get('/admin/device/:dongle_id/ignore/:ignore_uploads', runAsyncWrapper(async (req, res) => {
  if (!req.params.dongle_id || !req.params.ignore_uploads) { return req.status(400).json({ error: true, msg: 'MISSING DATA', status: 400 }); }

  let ignore = null;

  switch (req.params.ignore_uploads) {
    case 'true':
      ignore = true;
      break;
    case 'false':
      ignore = false;
      break;
    default:
      return res.json({ error: true, msg: 'MISSING DATA' });
  }

  await controllers.devices.setIgnoredUploads(req.params.dongle_id);
  return res.status(200).json({ success: true });
}));

router.get('/device/:dongle_id/athena/reboot', runAsyncWrapper(async (req, res) => {
  req.athenaWebsocketTemp.rebootDevice(req.params.dongle_id);
  res.send('ok');
}));

module.exports = (_models, _controllers, _logger) => {
  models = _models;
  controllers = _controllers;
  logger = _logger;

  return router;
};
