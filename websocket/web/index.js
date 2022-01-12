import WebSocket, { WebSocketServer } from 'ws';
import cookie from 'cookie';
import httpServer from 'http';
import log4js from 'log4js';
import config from '../../config.js';
import controlsFunction from './controls.js';
import authenticationController from '../../controllers/authentication.js';

// eslint-disable-next-line no-unused-vars
import deviceController from '../../controllers/devices';

import athenaRealtime from '../athena/index.js';
import realtimeCommands from './commands.js';

const logger = log4js.getLogger('default');

let server;
let wss;
let controls;

// eslint-disable-next-line no-underscore-dangle
function __server() {
  server = httpServer.createServer();

  wss = new WebSocketServer({ server }, { path: '/realtime/v1', handshakeTimeout: 500 });

  server.listen(config.clientSocket.port, config.clientSocket.host, () => {
    logger.info(`Web(Server) - UP @ ${config.clientSocket.host}:${config.clientSocket.port}`);
  });

  wss.on('connection', manageConnection);
  wss.on('close', () => {
    logger.info('Web(Websocket) - DOWN');
  });
  return wss;
}

// eslint-disable-next-line no-unused-vars
function buildResponse(ws, success, msg, data) {
  ws.send(JSON.stringify({
    success, msg, data, timestamp: Date.now(),
  }));
}

async function authenticateUser(ws, req) {
  // if (req.headers.Authorization) {
  //   account = await authenticationController.getAccountFromJWT(req.headers.Authorization)
  // }

  if (!req.headers.cookie) {
    // TODO: send error
    ws.terminate();
    return false;
  }

  const cookies = cookie.parse(req.headers.cookie);
  if (!cookies.jwt) {
    // TODO: send error
    ws.terminate();
    return false;
  }

  const account = await authenticationController.getAccountFromJWT(cookies.jwt);
  if (!account) {
    // TODO: send error
    ws.terminate();
    return false;
  }

  // eslint-disable-next-line no-param-reassign
  ws.account = account;
  return true;
}

async function manageConnection(ws, req) {
  logger.info(`Web(Websocket) - New Connection ${ws._socket.remoteAddress}`);

  await authenticateUser(ws, req);

  console.log(ws.account);

  ws.on('message', async (message) => {
    console.log(message);
    const msg = JSON.parse(message.toString('utf8'));

    switch (msg.command) {
      case 'is_dongle_online':
        return realtimeCommands.isDongleOnline(ws, msg);
      case 'reboot_dongle':
        return realtimeCommands.rebootDongle(ws, msg);
      case 'take_snapshot':
        return realtimeCommands.takeSnapshot(ws, msg);
      default:
        return ws.send(JSON.stringify({
          error: true, id: msg.id || null, msg: 'VERIFY_DATA', data: { msg },
        }));
    }
  });

  return wss;

  // ws.send(JSON.stringify(await commandBuilder('reboot')))
}

const websocketServer = __server();

controls = controlsFunction(websocketServer);

athenaRealtime.realtimeCallback(controls);

export default {
  controls,
  websocketServer,
};
