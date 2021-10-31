const WebSocket = require('ws');
const fs = require('fs');
const cookie = require('cookie')
const jsonwebtoken = require('jsonwebtoken');
const models = require('./../models/index.model')

const authenticationController = require('./../controllers/authentication');
const deviceController = require('./../controllers/devices');
const { ws } = require('../routes/api/realtime');

var abnf = require('abnf');

let wss;
async function __server() {
  wss = new WebSocket.WebSocketServer({ path: '/ws/v2/', port: 4040, handshakeTimeout: 500 });

  console.log("src")

  const interval = setInterval(function ping() {
    wss.clients.forEach(function each(ws) {
      if (ws.isAlive === false) {
        wss.retropilotFunc.actionLogger(null, null, "ATHENA_DEVICE_TIMEOUT_FORCE_DISCONNECT", null, ws._socket.remoteAddress, null, ws.dongleId);
        console.log("TERMINATED", ws.dongleId)
        return ws.terminate();
      }

      ws.isAlive = false;
      ws.ping();
    });
  }, 5000);

  wss.on('connection', manageConnection)
  wss.on('close', function close() {
    clearInterval(interval);
  });

}

async function heartbeat() {
  if (this.heartbeat - Date.now() > 300) {
    deviceController.updateLastPing(this.device_id, this.dongleId);
  }

  this.isAlive = true;
  this.heartbeat = Date.now();
}

async function manageConnection(ws, res) {
  ws.badMessages = 0;
  ws.isAlive = true;
  ws.heartbeat = Date.now();
  ws.on('pong', heartbeat);

  var cookies = cookie.parse(res.headers.cookie);
  ws.on('message', async function incoming(message) {
    heartbeat.call(ws)
    if (!ws.dongleId) {
     // wss.retropilotFunc.actionLogger(null, null, "ATHENA_DEVICE_UNATHENTICATED_MESSAGE", null, ws._socket.remoteAddress, JSON.stringify([message]), ws.dongleId);
      console.log("unauthenticated message, discarded");
      return null;
    }

    console.log(message);

    const json = JSON.parse(message.toString('utf8'))
    console.log(json);

    console.log({device_id: ws.device_id, uuid: json.id});

    console.log( await models.models.athena_returned_data.update({
      data: JSON.stringify(json),
      resolved_at: Date.now()
    }, {where: {device_id: ws.device_id, uuid: json.id}}))

 
    wss.retropilotFunc.actionLogger(null, null, "ATHENA_DEVICE_MESSAGE_UNKNOWN", null, ws._socket.remoteAddress, JSON.stringify([message]), ws.dongleId);

    console.log(json)


  });


  if (await wss.retropilotFunc.authenticateDongle(ws, res, cookies) === false) {
    ws.close();
  }

  //ws.send(JSON.stringify(await commandBuilder('reboot')))
}



__server();

wss.retropilotFunc = {

  findFromDongle: (dongleId) => {
    let websocket = null;
    wss.clients.forEach((value) => {
      if (value.dongleId === dongleId) {
        websocket = value;
      }
    })

    return websocket;
  },

  authenticateDongle: async (ws, res, cookies) => {
    unsafeJwt = jsonwebtoken.decode(cookies.jwt);
    const device = await deviceController.getDeviceFromDongle(unsafeJwt.identity)

    let verifiedJWT;

    try {
      verifiedJWT = jsonwebtoken.verify(cookies.jwt, device.public_key, { ignoreNotBefore: true });
    } catch (err) {
      wss.retropilotFunc.actionLogger(null, null, "ATHENA_DEVICE_AUTHENTICATE_INVALID", null, ws._socket.remoteAddress, JSON.stringify({ jwt: cookies.jwt }), null);
      return false;
    }

    if (verifiedJWT.identify === unsafeJwt.identify) {
      ws.dongleId = device.dongle_id
      ws.device_id = device.id
      console.log("AUTHENTICATED DONGLE", ws.dongleId)

      wss.retropilotFunc.actionLogger(null, device.id, "ATHENA_DEVICE_AUTHENTICATE_SUCCESS", null, ws._socket.remoteAddress, null);
      return true;
    } else {
      console.log("UNAUTHENTICATED DONGLE");

      wss.retropilotFunc.actionLogger(null, device.id, "ATHENA_DEVICE_AUTHENTICATE_FAILURE", null, ws._socket.remoteAddress, JSON.stringify({ jwt: cookies.jwt }), null);
      return false;
    }
  },

  commandBuilder: (method, params, id) => {
    return { method, params: params, "jsonrpc": "2.0", "id": id }
  },

  actionLogger: async (account_id, device_id, action, user_ip, device_ip, meta, dongle_id) => {
    models.models.athena_action_log.create({
      account_id, device_id, action, user_ip, device_ip, meta, created_at: Date.now(), dongle_id
    })
  },

}

const helpers = require('./helpers')(wss)


module.exports = helpers;