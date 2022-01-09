/* eslint-disable global-require, no-unused-vars */

// TO DO, finish up removing this callback stuff
module.exports = async (models, logger, modelsSql) => ({
  authentication: require('./authentication'),
  helpers: require('./helpers'),
  storage: require('./storage')(models, logger),
  mailing: require('./mailing')(models, logger),
  users: require('./users'),
  admin: require('./admin'),
  devices: require('./devices'),
});
