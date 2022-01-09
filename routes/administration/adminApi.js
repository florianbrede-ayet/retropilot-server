const router = require('express').Router();
const controllers = require('../../controllers');

function runAsyncWrapper(callback) {
  return function wrapper(req, res, next) {
    callback(req, res, next)
      .catch(next);
  };
}

// probs should put middleware somewhere else
router.use(async (req, res, next) => {
  const currentAdmin = await controllers.admin.isCurrentUserAdmin(true, req);
  if (!currentAdmin.account) {
    return res.status(401).json({ error: true, msg: 'UNAUTHORISED', status: 401 }).end();
  }
  if (!currentAdmin.isAdmin) {
    return res.status(403).json({ error: true, msg: 'FORBIDDEN', status: 403 }).end();
  }
  return next();
});

// TODO

router.get('/user/:userId/ban/:ban', runAsyncWrapper(async (req, res) => {
  const banResult = await controllers.admin.banAccount(req.params.ban, req.params.userId);
  if (!banResult.success) {
    return res.status(500).json(banResult);
  }

  return res.status(200).json(banResult);
}));

router.get('/user/:userId/get/devices', runAsyncWrapper(async (req, res) => {
  if (!req.params.userId) {
    return req.status(400).json({ error: true, msg: 'MISSING DATA', status: 400 });
  }

  return res.status(200).json({
    success: true,
    data: controllers.devices.getDevices(req.params.userId),
  });
}));

router.get('/user/', runAsyncWrapper(async (req, res) => {
  console.warn('PROCESSED');

  return res.status(200).json({ success: true, data: await controllers.users.getAllUsers() });
}));

router.get('/device/:dongle_id', runAsyncWrapper(async (req, res) => {
  const { dongle_id: dongleId } = req.params;
  if (!dongleId) {
    return req.status(400).json({ error: true, msg: 'MISSING DATA', status: 400 });
  }

  const device = await controllers.devices.getDeviceFromDongle(dongleId);
  return res.status(200).json({ success: true, data: device });
}));

router.get('/device/:dongle_id/pair/:user_id', runAsyncWrapper(async (req, res) => {
  const { dongle_id: dongleId, user_id: userId } = req.params;
  if (!dongleId || !userId) {
    return req.status(400).json({ error: true, msg: 'MISSING DATA', status: 400 });
  }

  const pairDeviceToAccountId = await controllers.devices.pairDeviceToAccountId(dongleId, userId);
  return res.status(200).json(pairDeviceToAccountId);
}));

router.get('/device', runAsyncWrapper(async (req, res) => {
  const filteredDevices = await controllers.devices.getAllDevicesFiltered();
  console.log('fil', filteredDevices);
  return res.status(200).json({ success: true, data: filteredDevices });
}));

router.get('/device/:dongle_id/ignore/:ignore_uploads', runAsyncWrapper(async (req, res) => {
  const { dongle_id: dongleId, ignore_uploads: ignoreUploads } = req.params;
  if (!dongleId || !ignoreUploads) {
    return req.status(400).json({ error: true, msg: 'MISSING DATA', status: 400 });
  }

  // TODO make this cleaner
  let isIgnored = null;
  switch (ignoreUploads) {
    case 'true':
      isIgnored = true;
      break;
    case 'false':
      isIgnored = false;
      break;
    default:
      return res.json({ error: true, msg: 'MISSING DATA' });
  }

  await controllers.devices.setIgnoredUploads(req.params.dongle_id, isIgnored);
  return res.status(200).json({ success: true });
}));

router.get('/device/:dongle_id/athena/reboot', runAsyncWrapper(async (req, res) => {
  const { dongle_id: dongleId } = req.params;
  req.athenaWebsocketTemp.rebootDevice(dongleId);
  res.send('ok');
}));

module.exports = router;
