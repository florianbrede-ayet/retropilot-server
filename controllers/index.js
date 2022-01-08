/* eslint-disable global-require */
const config = require('../config');

// TO DO, finish up removing this callback stuff
module.exports = async (models, logger, models_sqli) => ({
  authentication: require('./authentication'),
  helpers: require('./helpers')(models, logger),
  storage: require('./storage')(models, logger),
  mailing: require('./mailing')(models, logger),
  users: require('./users'),
  admin: require('./admin'),
  devices: require('./devices')
});
