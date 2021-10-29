const WebSocket = require('ws');
const fs = require('fs');
const cookie = require('cookie')
const jsonwebtoken = require('jsonwebtoken');
const models = require('./../models/index.model')

const authenticationController = require('./../controllers/authentication');
const deviceController = require('./../controllers/devices');
const { ws } = require('../routes/api/realtime');

let wss; 
async function __server() {
  wss = new WebSocket.WebSocketServer({ path: '/ws/v2/', port: 4040, handshakeTimeout: 500});
  
  console.log("src")

  const interval = setInterval(function ping() {
    wss.clients.forEach(function each(ws) {
      if (ws.isAlive === false) {
        _actionLogger(null, null, "ATHENA_DEVICE_TIMEOUT_FORCE_DISCONNECT", null, ws._socket.remoteAddress, null, ws.dongleId);
        return ws.terminate();
      }

      ws.isAlive = false;
      ws.ping();
    });
  }, 5000);

  wss.on('connection',  manageConnection)
  wss.on('close', function close() {
    clearInterval(interval);
  });


}



const authenticateDongle = async (ws, res, cookies) => {
  unsafeJwt = jsonwebtoken.decode(cookies.jwt);
  const device = await deviceController.getDeviceFromDongle(unsafeJwt.identity)

    let verifiedJWT;

    try {
      verifiedJWT = jsonwebtoken.verify(cookies.jwt, device.public_key, {ignoreNotBefore: true});
    } catch (err) {
      _actionLogger(null, null, "ATHENA_DEVICE_AUTHENTICATE_INVALID", null, ws._socket.remoteAddress, JSON.stringify({jwt: cookies.jwt}), null);
      return false;
    }

  
    if (verifiedJWT.identify === unsafeJwt.identify) {

        ws.dongleId = device.dongle_id
        ws.device_id = device.id
        console.log("AUTHENTICATED DONGLE", ws.dongleId )

        _actionLogger(null, device.id, "ATHENA_DEVICE_AUTHENTICATE_SUCCESS", null, ws._socket.remoteAddress, null);
        return true;
    } else {
      console.log("UNAUTHENTICATED DONGLE");

        _actionLogger(null, device.id, "ATHENA_DEVICE_AUTHENTICATE_FAILURE", null, ws._socket.remoteAddress, JSON.stringify({jwt: cookies.jwt}), null);
        return false;
    }
}


function commandBuilder(method, params) {
  return { method, params, "jsonrpc": "2.0", "id": 0 }
}


async function heartbeat() {

  if (this.heartbeat - Date.now() > 300) {
    deviceController.updateLastPing(this.device_id, this.dongleId);
  }

  this.isAlive = true;
  this.heartbeat = Date.now();

}

async function _actionLogger(account_id, device_id, action, user_ip, device_ip, meta, dongle_id) {
  models.models.athena_action_log.create({
    account_id, device_id, action, user_ip, device_ip, meta, created_at: Date.now(), dongle_id
  })
}

async function manageConnection(ws, res)  {
  ws.badMessages = 0;
  ws.isAlive = true;

  ws.heartbeat = Date.now();
  
  ws.on('pong', heartbeat);

  var cookies = cookie.parse(res.headers.cookie);


  ws.on('message', function incoming(message) {
    heartbeat.call(ws)
    if (!ws.dongleId) { 
      _actionLogger(null, null, "ATHENA_DEVICE_UNATHENTICATED_MESSAGE", null, ws._socket.remoteAddress, JSON.stringify([message]), ws.dongleId);
      console.log("unauthenticated message, discarded"); 
      return null; 
    }



    models.models.athena_returned_data.create({
      device_id: ws.device_id,
      type: "UNKNOWN",
      data: JSON.stringify(message),
      created_at: Date.now()

    })

    _actionLogger(null, null, "ATHENA_DEVICE_MESSAGE_UNKNOWN", null, ws._socket.remoteAddress, JSON.stringify([message]), ws.dongleId);
    const buff = Buffer.from(JSON.stringify(message), 'utf-8');

// decode buffer as UTF-8
    console.log(buff.toString('base64'))

  });

  
  if (await authenticateDongle(ws, res, cookies) === false) {
    ws.close();
  }

  //ws.send(JSON.stringify(await commandBuilder('reboot')))

}


__server();




function _findSocketFromDongle(dongleId) {

  let websocket = null;
  wss.clients.forEach((value) => {
    if (value.dongleId === dongleId) {
      websocket = value;
    }
  })

  return websocket;
}



function invoke(command, params, dongleId, accountId) {
  const websocket = _findSocketFromDongle(dongleId);

  if (!websocket) {
    _actionLogger(accountId, null, "ATHENA_USER_INVOKE__FAILED_DISCONNECTED", null, null, null, dongleId);
    return {connected: false}
  }

  _actionLogger(accountId, websocket.device_id, "ATHENA_USER_INVOKE__ISSUED", null, websocket._socket.remoteAddress, JSON.stringify({command, params}), websocket.dongleId);

  websocket.send(JSON.stringify(commandBuilder(command)))

  return {dispatched: true, heartbeat: websocket.heartbeat}

}


function isDeviceConnected(accountId, deviceId, dongleId ) {
  const websocket = _findSocketFromDongle(dongleId);
  _actionLogger(accountId, deviceId, "ATHENA_USER_STATUS__IS_CONNECTED", null, websocket ? websocket._socket.remoteAddress : null, JSON.stringify({connected: websocket ? true : false, heartbeat: websocket ? websocket.heartbeat : null}), dongleId);

  if (!websocket) return {connected: false}

  return {connected: true, heartbeat: websocket.heartbeat};
}





module.exports = {
  invoke,
  isDeviceConnected
}
