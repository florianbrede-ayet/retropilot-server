const config = require('./config');
const fs = require('fs');
const log4js = require('log4js');
const lockfile = require('proper-lockfile');
const http = require('http');
const https = require('https');
const express = require('express');
const cors = require('cors');
const rateLimit = require("express-rate-limit");

log4js.configure({
    appenders: {logfile: {type: "file", filename: "server.log"}, out: {type: 'console'} /*{type: "file", filename: "server1.log"}*/},
    categories: {default: {appenders: ['out', 'logfile'], level: 'info'}},

});


const logger = log4js.getLogger('default');
// TODO evaluate if this is the best way to determine the root of project
global.__basedir = __dirname;

let models = require('./models/index');
let models_sqli = require('./models/index.model');
let controllers = require('./controllers');
let routers = require('./routes')
const athena = require('./websocket/athena');
const webWebsocket = require('./websocket/web');
var cookieParser = require('cookie-parser');
const router = require('./routes/api/realtime');



let db;


// TODO
function runAsyncWrapper(callback) {
    return function (req, res, next) {
        callback(req, res, next)
            .catch(next)
    }
}


const app = express();


const athenaRateLimit = rateLimit({
    windowMs: 30000,
    max: config.athena.api.ratelimit
});





const web = async () => {
    // TODO clean up
    const _models = await models(logger);
    db = _models.models.__db;
    models = _models.models;

    app.use(function(req, res, next) {
        res.header('Access-Control-Allow-Origin', "http://localhost:3000");
        res.header('Access-Control-Allow-Credentials', true);
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
        next();
      });

    const _controllers = await controllers(models, logger);
    controllers = _controllers;


    controllers.storage.initializeStorage();
    await controllers.storage.updateTotalStorageUsed();

    routers = routers(models, controllers, logger)
    app.use(routers.api);
    app.use(routers.useradmin);
    app.use(routers.authenticationApi)

    if (config.athena.enabled) {
        app.use((req, res, next) => {
            req.athenaWebsocketTemp = athena;
            return next();
        });
    
    
        app.use('/admin', routers.admin);
        app.use('/realtime', athenaRateLimit);
        app.use('/realtime', routers.realtime);
    } else {
        logger.log("Athena disabled");
    }


    

    


    app.use(cors({origin: 'http://localhost:3000',}));
    app.use(cookieParser());
    app.use('/favicon.ico', express.static('static/favicon.ico'));
    app.use(config.baseDriveDownloadPathMapping, express.static(config.storagePath));

    app.use(routers.deviceApi)

    app.use('/.well-known', express.static('.well-known'));

    app.use('/cabana', express.static('cabana/'));


    app.get('/', async (req, res) => {
        res.status(200);
        var response = '<html style="font-family: monospace"><h2>404 Not found</h2>' +
            'Are you looking for the <a href="/useradmin">useradmin dashboard</a>?';
        res.send(response);
    })


    app.get('*', runAsyncWrapper(async (req, res) => {
        logger.error("HTTP.GET unhandled request: " + controllers.helpers.simpleStringify(req) + ", " + controllers.helpers.simpleStringify(res) + "")
        res.status(404);
        res.send('Not Implemented');
    }))


    app.post('*', runAsyncWrapper(async (req, res) => {
        logger.error("HTTP.POST unhandled request: " + controllers.helpers.simpleStringify(req) + ", " + controllers.helpers.simpleStringify(res) + "")
        res.status(404);
        res.send('Not Implemented');
    }));

}


lockfile.lock('retropilot_server.lock', {realpath: false, stale: 30000, update: 2000})
    .then((release) => {
        console.log("STARTING SERVER...");
        web();
        (async () => {


            var privateKey = fs.readFileSync(config.sslKey, 'utf8');
            var certificate = fs.readFileSync(config.sslCrt, 'utf8');
            var sslCredentials = {key: privateKey, cert: certificate/* ,    ca: fs.readFileSync('certs/ca.crt') */};

            var httpServer = http.createServer(app);
            var httpsServer = https.createServer(sslCredentials, app);


            httpServer.listen(config.httpPort, config.httpInterface, () => {
                logger.info(`Retropilot Server listening at http://${config.httpInterface}:${config.httpPort}`)
            });
            httpsServer.listen(config.httpsPort, config.httpsInterface, () => {
                logger.info(`Retropilot Server listening at https://${config.httpsInterface}:${config.httpsPort}`)
            });

        })();

    }).catch((e) => {
    console.error(e)
    process.exit();
});




module.exports = app;
