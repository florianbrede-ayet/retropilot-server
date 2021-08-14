const config = require('./config');
const fs = require('fs');
const log4js = require('log4js');
const lockfile = require('proper-lockfile');
const http = require('http');
const https = require('https');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

log4js.configure({
    appenders: {logfile: {type: "file", filename: "server.log"}, out: {type: 'console'} /*{type: "file", filename: "server1.log"}*/},
    categories: {default: {appenders: ['out', 'logfile'], level: 'info'}},

});

const logger = log4js.getLogger('default');
// TODO evaluate if this is the best way to determine the root of project
global.__basedir = __dirname;

let models = require('./models/index');
let controllers = require('./controllers');
let routers = require('./routes')

let db;


// TODO
function runAsyncWrapper(callback) {
    return function (req, res, next) {
        callback(req, res, next)
            .catch(next)
    }
}


const app = express();


const web = async () => {
    // TODO clean up
    const _models = await models(logger);
    db = _models.models.__db;
    models = _models.models;

    const _controllers = await controllers(models, logger);
    controllers = _controllers;


    controllers.storage.initializeStorage();
    await controllers.storage.updateTotalStorageUsed();

    routers = routers(models, controllers, logger)
    app.use(routers.api);
    app.use(routers.useradmin);

    if (config.flags.useUserAdminApi) app.use(routers.useradminapi);
    app.use(routers.adminApi)


    app.use(cors());
    app.use(cookieParser(config.applicationSalt))

    app.use('/favicon.ico', express.static('static/favicon.ico'));
    app.use(config.baseDriveDownloadPathMapping, express.static(config.storagePath));

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
        res.status(400);
        res.send('Not Implemented');
    }))


    app.post('*', runAsyncWrapper(async (req, res) => {
        logger.error("HTTP.POST unhandled request: " + controllers.helpers.simpleStringify(req) + ", " + controllers.helpers.simpleStringify(res) + "")
        res.status(400);
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
                logger.info(`Retropilot Server listening at http://` + config.httpInterface + `:` + config.httpPort)
            });
            httpsServer.listen(config.httpsPort, config.httpsInterface, () => {
                logger.info(`Retropilot Server listening at https://` + config.httpsInterface + `:` + config.httpsPort)
            });

        })();

    }).catch((e) => {
    console.error(e)
    process.exit();
});




module.exports = app;
