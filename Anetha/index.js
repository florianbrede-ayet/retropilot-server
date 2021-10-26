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
        _actionLogger(null, device.id, "ATHENA_DEVICE_AUTHENTICATE_SUCCESS", null, ws._socket.remoteAddress, null);
        console.log("AUTHENTICATED DONGLE", ws.dongleId )
        return true;
    } else {
        _actionLogger(null, device.id, "ATHENA_DEVICE_AUTHENTICATE_FAILURE", null, ws._socket.remoteAddress, JSON.stringify({jwt: cookies.jwt}), null);
        console.log("UNAUTHENTICATED DONGLE");
        return false;
    }
}


function commandBuilder(method, params) {
  return { method, params, "jsonrpc": "2.0", "id": 0 }
}


async function heartbeat() {
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


    _actionLogger(null, null, "ATHENA_DEVICE_MESSAGE_UNKNOWN", null, ws._socket.remoteAddress, JSON.stringify([message]), ws.dongleId);
    console.log("unknown message", JSON.stringify(message))
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




// TODO - This is dumb
function rebootDevice(dongleId, accountId) {
  const websocket = _findSocketFromDongle(dongleId);
  

  if (!websocket) {
    return _actionLogger(accountId, null, "ATHENA_USER_INVOKE__REBOOT_FAILED_DISCONNECTED", null, null, null, ws.dongleId);
  }

  _actionLogger(accountId, null, "ATHENA_USER_INVOKE__REBOOT_ISSUED", null, ws._socket.remoteAddress, null, ws.dongleId);

  websocket.send(JSON.stringify(commandBuilder('reboot')))

}


function getDetails(dongleId, accountId) {
  const websocket = _findSocketFromDongle(dongleId);

  if (!websocket) {
    return _actionLogger(accountId, null, "ATHENA_USER_INVOKE__GETVERSION_FAILED_DISCONNECTED", null, null, null, ws.dongleId);
  }

  _actionLogger(accountId, null, "ATHENA_USER_INVOKE__GETVERSION_ISSUED", null, ws._socket.remoteAddress, null, ws.dongleId);

  websocket.send(JSON.stringify(commandBuilder('getVersion')))

}


function isDeviceConnected(dongleId, accountId) {
  const websocket = _findSocketFromDongle(dongleId);
  _actionLogger(null, null, "ATHENA_USER_STATUS__IS_CONNECTED", null, websocket ? websocket._socket.remoteAddress : null, JSON.stringify({connected: websocket ? true : false, heartbeat: websocket ? websocket.heartbeat : null}), dongleId);

  if (!websocket) return {connected: false}

  return {connected: true, heartbeat: websocket.heartbeat};
}





module.exports = {
  rebootDevice,
  isDeviceConnected,
  getDetails
}
