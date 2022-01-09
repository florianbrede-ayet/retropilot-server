/* eslint-disable global-require */
const fs = require('fs');
const log4js = require('log4js');
const lockfile = require('proper-lockfile');
const http = require('http');
const https = require('https');
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

log4js.configure({
  appenders: { logfile: { type: 'file', filename: 'server.log' }, out: { type: 'console' } /* {type: "file", filename: "server1.log"} */ },
  categories: { default: { appenders: ['out', 'logfile'], level: 'info' } },
});

const logger = log4js.getLogger('default');
// TODO evaluate if this is the best way to determine the root of project
global.__basedir = __dirname;

/* eslint-disable no-unused-vars */
const cookieParser = require('cookie-parser');
const webWebsocket = require('./websocket/web');
const athena = require('./websocket/athena');
let routers = require('./routes');
const orm = require('./models/index.model');
let controllers = require('./controllers');
let models = require('./models/index');
const router = require('./routes/api/realtime');
/* eslint-enable no-unused-vars */

const config = require('./config');

function runAsyncWrapper(callback) {
  return function wrapper(req, res, next) {
    callback(req, res, next)
      .catch(next);
  };
}

const web = async () => {
  const app = express();

  models = await models(logger).models;

  app.use((req, res, next) => {
    // TODO: can we use config.baseUrl here?
    res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
    res.header('Access-Control-Allow-Credentials', true);
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
  });

  controllers = await controllers(models, logger);

  controllers.storage.initializeStorage();
  await controllers.storage.updateTotalStorageUsed();

  routers = routers(models, controllers, logger);
  app.use(routers.api);
  app.use(routers.useradmin);
  app.use(routers.authenticationApi);

  if (config.athena.enabled) {
    const athenaRateLimit = rateLimit({
      windowMs: 30000,
      max: config.athena.api.ratelimit,
    });

    app.use((req, res, next) => {
      req.athenaWebsocketTemp = athena;
      return next();
    });

    app.use('/admin', routers.admin);
    app.use('/realtime', athenaRateLimit);
    app.use('/realtime', routers.realtime);
  } else {
    logger.log('Athena disabled');
  }

  app.use(cors({ origin: 'http://localhost:3000' }));
  app.use(cookieParser());
  app.use('/favicon.ico', express.static('static/favicon.ico'));
  app.use(config.baseDriveDownloadPathMapping, express.static(config.storagePath));

  app.use(routers.deviceApi);

  app.use('/.well-known', express.static('.well-known'));

  app.use('/cabana', express.static('cabana/'));

  app.get('/', async (req, res) => {
    res.status(200);
    const response = '<html style="font-family: monospace"><h2>404 Not found</h2>'
            + 'Are you looking for the <a href="/useradmin">useradmin dashboard</a>?';
    res.send(response);
  });

  app.get('*', runAsyncWrapper(async (req, res) => {
    logger.error(`HTTP.GET unhandled request: ${controllers.helpers.simpleStringify(req)}, ${controllers.helpers.simpleStringify(res)}`);
    res.status(404);
    res.send('Not Implemented');
  }));

  app.post('*', runAsyncWrapper(async (req, res) => {
    logger.error(`HTTP.POST unhandled request: ${controllers.helpers.simpleStringify(req)}, ${controllers.helpers.simpleStringify(res)}`);
    res.status(404);
    res.send('Not Implemented');
  }));
};

lockfile.lock('retropilot_server', { realpath: false, stale: 30000, update: 2000 })
  .then(async () => {
    console.log('STARTING SERVER...');
    const app = await web();

    const key = fs.readFileSync(config.sslKey, 'utf8');
    const cert = fs.readFileSync(config.sslCrt, 'utf8');

    const httpServer = http.createServer(app);
    const httpsServer = https.createServer({ key, cert }, app);

    httpServer.listen(config.httpPort, config.httpInterface, () => {
      logger.info(`Retropilot Server listening at http://${config.httpInterface}:${config.httpPort}`);
    });
    httpsServer.listen(config.httpsPort, config.httpsInterface, () => {
      logger.info(`Retropilot Server listening at https://${config.httpsInterface}:${config.httpsPort}`);
    });
  }).catch((e) => {
    console.error(e);
    process.exit();
  });
