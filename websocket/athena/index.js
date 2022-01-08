const WebSocket = require('ws');
const cookie = require('cookie');
const jsonwebtoken = require('jsonwebtoken');
const httpsServer = require('https');
const httpServer = require('http');
const { readFileSync } = require('fs');
const log4js = require('log4js');
const models = require('../../models/index.model');
const config = require('../../config');

const authenticationController = require('../../controllers/authentication');
const deviceController = require('../../controllers/devices');

const logger = log4js.getLogger('default');

let wss;
function __server() {
  let server;

  if (config.athena.secure) {
    server = httpsServer.createServer({
      cert: readFileSync(config.sslCrt),
      key: readFileSync(config.sslKey),
    });
  } else {
    server = httpServer.createServer();
  }

  wss = new WebSocket.WebSocketServer({ server }, { path: '/ws/v2/', handshakeTimeout: 500 });

  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        logger.info(`Athena(Heartbeat) - Terminated ${ws.dongleId} - ${ws._socket.remoteAddress}`);
        wss.retropilotFunc.actionLogger(null, null, 'ATHENA_DEVICE_TIMEOUT_FORCE_DISCONNECT', null, ws._socket.remoteAddress, null, ws.dongleId);
        if (ws.dongleId) {
          helpers.deviceStatus(ws.dongleId, false);
        }

        ws.terminate();
        return;
      }

      ws.isAlive = false;
      ws.ping();
    });
  }, config.athena.socket.heartbeatFrequency ? config.athena.socket.heartbeatFrequency : 5000);

  server.listen(config.athena.socket.port, () => {
    logger.info(`Athena(Server) - UP @ ${config.athena.host}:${config.athena.port}`);
  });

  wss.on('connection', manageConnection);
  wss.on('close', () => {
    logger.info('Athena(Websocket) - DOWN');
    clearInterval(interval);
  });
}

async function heartbeat() {
  this.isAlive = true;
  this.heartbeat = Date.now();
  if (this.dongleId) {
    helpers.deviceStatus(this.dongleId, true);
  }
}

async function manageConnection(ws, res) {
  logger.info(`Athena(Websocket) - New Connection ${ws._socket.remoteAddress}`);
  ws.badMessages = 0;
  ws.isAlive = true;
  ws.heartbeat = Date.now();
  ws.on('pong', heartbeat);

  const cookies = cookie.parse(res.headers.cookie);

  ws.on('message', async (message) => {
    heartbeat.call(ws);
    if (!ws.dongleId) {
      wss.retropilotFunc.actionLogger(null, null, 'ATHENA_DEVICE_UNATHENTICATED_MESSAGE', null, ws._socket.remoteAddress, JSON.stringify([message]), ws.dongleId);
      console.log('unauthenticated message, discarded');
      return;
    }

    const json = JSON.parse(message.toString('utf8'));
    console.log(json);

    console.log({ device_id: ws.device_id, uuid: json.id });

    console.log(await models.models.athena_returned_data.update({
      data: JSON.stringify(json),
      resolved_at: Date.now(),
    }, { where: { device_id: ws.device_id, uuid: json.id } }));

    wss.retropilotFunc.actionLogger(null, null, 'ATHENA_DEVICE_MESSAGE_UNKNOWN', null, ws._socket.remoteAddress, JSON.stringify([message]), ws.dongleId);

    console.log(json);

    helpers.incoming(ws, res, json);
  });

  if (await wss.retropilotFunc.authenticateDongle(ws, res, cookies) === false) {
    ws.terminate();
  }

  // ws.send(JSON.stringify(await commandBuilder('reboot')))
}

__server();

wss.retropilotFunc = {

  findFromDongle: (dongleId) => {
    let websocket = null;
    wss.clients.forEach((value) => {
      if (value.dongleId === dongleId) {
        websocket = value;
      }
    });

    return websocket;
  },

  authenticateDongle: async (ws, res, cookies) => {
    let unsafeJwt;

    try {
      unsafeJwt = jsonwebtoken.decode(cookies.jwt);
    } catch (e) {
      logger.info(`Athena(Websocket) - AUTHENTICATION FAILED (INVALID JWT) IP: ${ws._socket.remoteAddress}`);
      wss.retropilotFunc.actionLogger(null, null, 'ATHENA_DEVICE_AUTHENTICATE_INVALID', null, ws._socket.remoteAddress, JSON.stringify({ jwt: cookies.jwt }), null);
      return false;
    }

    const device = await deviceController.getDeviceFromDongle(unsafeJwt.identity);

    let verifiedJWT;

    try {
      verifiedJWT = jsonwebtoken.verify(cookies.jwt, device.public_key, { ignoreNotBefore: true });
    } catch (err) {
      logger.info(`Athena(Websocket) - AUTHENTICATION FAILED (BAD JWT, CHECK SIGNATURE) IP: ${ws._socket.remoteAddress}`);
      wss.retropilotFunc.actionLogger(null, null, 'ATHENA_DEVICE_AUTHENTICATE_INVALID', null, ws._socket.remoteAddress, JSON.stringify({ jwt: cookies.jwt }), null);
      return false;
    }

    if (verifiedJWT.identify === unsafeJwt.identify) {
      ws.dongleId = device.dongle_id;
      ws.device_id = device.id;
      wss.retropilotFunc.actionLogger(null, device.id, 'ATHENA_DEVICE_AUTHENTICATE_SUCCESS', null, ws._socket.remoteAddress, null);
      logger.info(`Athena(Websocket) - AUTHENTICATED IP: ${ws._socket.remoteAddress} DONGLE ID: ${ws.dongleId} DEVICE ID: ${ws.device_id}`);
      return true;
    }
    wss.retropilotFunc.actionLogger(null, device.id, 'ATHENA_DEVICE_AUTHENTICATE_FAILURE', null, ws._socket.remoteAddress, JSON.stringify({ jwt: cookies.jwt }), null);
    logger.info(`Athena(Websocket) - AUTHENTICATION FAILED (BAD CREDENTIALS) IP: ${ws._socket.remoteAddress}`);

    return false;
  },

  commandBuilder: (method, params, id) => ({
    method, params, jsonrpc: '2.0', id,
  }),

  /* eslint-disable camelcase */
  actionLogger: async (account_id, device_id, action, user_ip, device_ip, meta, dongle_id) => {
    models.models.athena_action_log.create({
      account_id, device_id, action, user_ip, device_ip, meta, created_at: Date.now(), dongle_id,
    });
  },
  /* eslint-enable camelcase */

};

const helpers = require('./helpers')(wss);

module.exports = helpers;
