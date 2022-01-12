// eslint-disable-next-line no-unused-vars
import authenticationController from '../../controllers/authentication';

import deviceController from '../../controllers/devices';
import athenaRealtime from '../athena/index';

// Checks if device is currently online in Athena

async function isDongleOnline(ws, msg) {
  // Checking if the user is authorised to access dongle, this will be used later
  // allowing users to delegate access.
  const isAuthorised = await deviceController.isUserAuthorised(ws.account.id, msg.data.dongleId);
  if (isAuthorised && isAuthorised.success === true) {
    ws.send(JSON.stringify({
      command: msg.command,
      success: true,
      id: msg.id || null,
      data: athenaRealtime.isDeviceConnected(ws.account.id, null, msg.data.dongleId),
    }));
  } else {
    ws.send(JSON.stringify({
      command: msg.command, success: false, id: msg.id || null, msg: 'not_authorised',
    }));
  }
}

// Checks if device is currently online in Athena

async function rebootDongle(ws, msg) {
  // Checking if the user is authorised to access dongle, this will be used later
  // allowing users to delegate access.
  const isAuthorised = await deviceController.isUserAuthorised(ws.account.id, msg.data.dongleId);
  console.log('is auth', isAuthorised);
  if (isAuthorised && isAuthorised.success === true) {
    await athenaRealtime.invoke('reboot', null, msg.data.dongleId, ws.account.id, msg.id || null);
    ws.send(JSON.stringify({
      command: msg.command, success: true, id: msg.id || null, data: { command_issued: true },
    }));
  } else {
    ws.send(JSON.stringify({
      command: msg.command, success: false, id: msg.id || null, msg: 'not_authorised',
    }));
  }
}

async function takeSnapshot(ws, msg) {
  const isAuthorised = await deviceController.isUserAuthorised(ws.account.id, msg.data.dongleId);
  console.log('is auth', isAuthorised);
  if (isAuthorised && isAuthorised.success === true) {
    await athenaRealtime.invoke('takeSnapshot', null, msg.data.dongleId, ws.account.id, msg.id || null);
    ws.send(JSON.stringify({
      command: msg.command, success: true, id: msg.id || null, data: { command_issued: true },
    }));
  } else {
    ws.send(JSON.stringify({
      command: msg.command, success: false, id: msg.id || null, msg: 'not_authorised',
    }));
  }
}

export default {
  isDongleOnline,
  rebootDongle,
  takeSnapshot,
};
