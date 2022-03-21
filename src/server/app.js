import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import log4js from 'log4js';

import storageController from './controllers/storage';
import athena from './websocket/athena';
import controllers from './controllers';
import routers from './routes';

const logger = log4js.getLogger('default');

function runAsyncWrapper(callback) {
  return function wrapper(req, res, next) {
    callback(req, res, next)
      .catch(next);
  };
}

const tasks = [];
const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', `${process.env.BASE_URL}`);
  res.header('Access-Control-Allow-Credentials', true);
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

storageController.initializeStorage();
tasks.push(storageController.updateTotalStorageUsed());

app.use(routers.api);
app.use(routers.useradmin);
app.use(routers.authenticationApi);

if (process.env.ATHENA_ENABLED) {
  const athenaRateLimit = rateLimit({
    windowMs: 30000,
    max: process.env.ATHENA_API_RATE_LIMIT,
  });

  app.use((req, res, next) => {
    req.athenaWebsocketTemp = athena;
    return next();
  });

  app.use('/admin', routers.admin);
  app.use('/realtime', athenaRateLimit);
  app.use('/realtime', routers.realtime);
  // app.use(routers.oauthAuthenticator)
} else {
  logger.log('Athena disabled');
}

app.use(cors({ origin: 'http://localhost:3000' }));
app.use(cookieParser());
app.use('/favicon.ico', express.static('static/favicon.ico'));
app.use(process.env.BASE_DRIVE_DOWNLOAD_PATH_MAPPING, express.static(process.env.STORAGE_PATH));

app.use(routers.deviceApi);

app.use('/.well-known', express.static('.well-known'));

app.use('/cabana', express.static('cabana/'));

app.get('/', async (req, res) => {
  res.redirect('/useradmin');
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

export default Promise.all(tasks).then(() => app);
