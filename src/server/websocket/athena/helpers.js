/* eslint-disable no-underscore-dangle */
import { v4 as uuid } from 'uuid';
import orm from '../../../models/index.model';

let realtime;
let wss;

async function incoming(ws, res, msg) {
  return realtime.passData(ws.dongleId, msg);
}

async function deviceStatus(dongleId, status) {
  return realtime.dongleStatus(dongleId, status);
}

function invoke(command, params, dongleId, accountId, id) {
  const websocket = wss.retropilotFunc.findFromDongle(dongleId);

  if (!websocket) {
    wss.retropilotFunc.actionLogger(accountId, null, 'ATHENA_USER_INVOKE__FAILED_DISCONNECTED', null, null, null, dongleId);
    return { connected: false };
  }

  let uniqueID;

  if (!id) {
    uniqueID = uuid();
  } else {
    uniqueID = id;
  }

  wss.retropilotFunc.actionLogger(accountId, websocket.device_id, 'ATHENA_USER_INVOKE__ISSUED', null, websocket._socket.remoteAddress, JSON.stringify({ command, params, uniqueID }), websocket.dongleId);

  orm.models.athena_returned_data.create({
    device_id: websocket.device_id,
    type: command,
    created_at: Date.now(),
    uuid: uniqueID,
  });

  websocket.send(JSON.stringify(wss.retropilotFunc.commandBuilder(command, params, uniqueID)));

  return { dispatched: true, heartbeat: websocket.heartbeat, id: uniqueID };
}

function isDeviceConnected(accountId, deviceId, dongleId) {
  const websocket = wss.retropilotFunc.findFromDongle(dongleId);
  wss.retropilotFunc.actionLogger(accountId, deviceId, 'ATHENA_USER_STATUS__IS_CONNECTED', null, websocket ? websocket._socket.remoteAddress : null, JSON.stringify({ connected: !!websocket, heartbeat: websocket ? websocket.heartbeat : null }), dongleId);

  if (!websocket) return { connected: false };

  return { connected: true, heartbeat: websocket.heartbeat };
}

async function realtimeCallback(callback) {
  realtime = callback;
}

export default (websocketServer) => {
  wss = websocketServer;

  return {
    isDeviceConnected,
    invoke,
    incoming,
    deviceStatus,
    realtimeCallback,
  };
};
