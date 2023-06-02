import 'dotenv/config';
import http from 'http';
import log4js from 'log4js';

log4js.configure({
  appenders: { logfile: { type: 'file', filename: 'server.log' }, out: { type: 'console' } /* {type: "file", filename: "server1.log"} */ },
  categories: { default: { appenders: ['out', 'logfile'], level: 'info' } },
});

process.on('unhandledRejection', (error, p) => {
  console.log('=== UNHANDLED REJECTION ===');
  console.log(error.promise, p);
  console.dir(error.stack);
});

const main = async () => {
  const logger = log4js.getLogger('default');
  const httpServer = http.createServer(await require('./app').default);

  httpServer.listen(process.env.HTTP_PORT, () => {
    logger.info(`RetroPilot Server listening at ${process.env.BASE_URL}`);
  });
};

try {
  main();
} catch (e) {
  console.error(e);
}
