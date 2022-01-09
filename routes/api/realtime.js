const router = require('express').Router();

/* eslint-disable no-unused-vars */
const authenticationController = require('../../controllers/authentication');
const userController = require('../../controllers/users');
const deviceController = require('../../controllers/devices');
const models = require('../../models/index.model');
/* eslint-enable no-unused-vars */

const whitelistParams = {
  getmessage: true,
  getversion: true,
  setnavdestination: true,
  listdatadirectory: true,
  reboot: true,
  uploadfiletourl: true,
  listuploadqueue: true,
  cancelupload: true,
  primeactivated: true,
  getpublickey: true,
  getsshauthorizedkeys: true,
  getsiminfo: true,
  getnetworktype: true,
  getnetworks: true,
  takesnapshot: true,
};

router.get('/dongle/:dongle_id/connected', async (req, res) => {
  const account = await authenticationController.getAuthenticatedAccount(req);
  if (account == null) {
    return res.status(403).json({
      error: true,
      errorMsg: 'Unauthenticated',
      errorObject: { authenticated: false },
    });
  }

  const { dongle_id: dongleId } = req.params;
  const device = await deviceController.getDeviceFromDongle(dongleId);
  if (!device) {
    return res.status(400).json({
      error: true,
      errorMsg: 'no_dongle',
      errorObject: { authenticated: true, dongle_exists: false },
    });
  }

  // TODO support delegation of access
  // TODO remove indication of dongle existing
  if (device.account_id !== account.id) {
    return res.status(403).json({
      error: true,
      errorMsg: 'unauthorised',
      errorObject: { authenticated: true, dongle_exists: true, authorised_user: false },
    });
  }

  // eslint-disable-next-line max-len
  const isConnected = await req.athenaWebsocketTemp.isDeviceConnected(account.id, device.id, dongleId);

  return res.status(200).json({
    success: true,
    dongle_id: device.dongle_id,
    data: isConnected,
  });
});

router.get('/dongle/:dongle_id/send/:method/', async (req, res) => {
  const { method } = req.params;
  if (!whitelistParams[method.toLowerCase()]) {
    return res.status(409).json({
      error: true,
      errorMsg: 'invalid_method',
      errorObject: { method },
    });
  }

  const account = await authenticationController.getAuthenticatedAccount(req);
  if (account == null) {
    return res.status(403).json({
      error: true,
      errorMsg: 'Unauthenticated',
      errorObject: { authenticated: false },
    });
  }

  const { dongle_id: dongleId } = req.params;
  const device = await deviceController.getDeviceFromDongle(dongleId);
  if (!device) {
    return res.status(400).json({
      error: true,
      errorMsg: 'no_dongle',
      errorObject: { authenticated: true, dongle_exists: false },
    });
  }

  // TODO support delegation of access
  // TODO remove indication of dongle existing
  if (device.account_id !== account.id) {
    return res.status(403).json({
      error: true,
      errorMsg: 'unauthorised',
      errorObject: { authenticated: true, dongle_exists: true, authorised_user: false },
    });
  }

  const data = await req.athenaWebsocketTemp.invoke(method, null, dongleId, account.id);

  return res.status(200).json({
    success: true,
    dongle_id: dongleId,
    method,
    data,
  });
});

router.get('/dongle/:dongle_id/get', async (req, res) => {
  const account = await authenticationController.getAuthenticatedAccount(req);
  if (account == null) {
    return res.status(403).json({
      error: true,
      errorMsg: 'Unauthenticated',
      errorObject: { authenticated: false },
    });
  }
  const device = await deviceController.getDeviceFromDongle(req.params.dongle_id);
  if (!device) {
    return res.status(400).json({
      error: true,
      errorMsg: 'no_dongle',
      errorObject: {
        authenticated: true,
        dongle_exists: false,
      },
    });
  }
  if (device.account_id !== account.id) {
    return res.status(403).json({
      error: true,
      errorMsg: 'unauthorised',
      errorObject: {
        authenticated: true,
        dongle_exists: true,
        authorised_user: false,
      },
    });
  }

  return res.json(await models.models.athena_returned_data.findAll({
    where: { device_id: device.id },
  }));
});

router.get('/dongle/:dongle_id/temp/nav/:lat/:long', async (req, res) => {
  if (!req.params.lat || !req.params.long) {
    return res.status(403).json({ error: true, errorMsg: 'Malformed_Request', errorObject: { malformed: true } });
  }
  const account = await authenticationController.getAuthenticatedAccount(req);
  if (account == null) {
    return res.status(403).json({ error: true, errorMsg: 'Unauthenticated', errorObject: { authenticated: false } });
  }
  const device = await deviceController.getDeviceFromDongle(req.params.dongle_id);
  if (!device) {
    return res.status(400).json({ error: true, errorMsg: 'no_dongle', errorObject: { authenticated: true, dongle_exists: false } });
  }
  if (device.account_id !== account.id) {
    return res.status(403).json({ error: true, errorMsg: 'unauthorised', errorObject: { authenticated: true, dongle_exists: true, authorised_user: false } });
  }

  const data = await req.athenaWebsocketTemp.invoke('setNavDestination', { latitude: req.params.lat, longitude: req.params.long }, device.dongle_id, account.id);

  return res.status(200).json({
    success: true, dongle_id: device.dongle_id, method: req.params.method, data,
  });
});

module.exports = router;
