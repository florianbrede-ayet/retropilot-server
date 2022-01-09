/* eslint-disable global-require, no-unused-vars */

// TO DO, finish up removing this callback stuff
module.exports = {
  authentication: require('./authentication'),
  helpers: require('./helpers'),
  storage: require('./storage'),
  mailing: require('./mailing'),
  users: require('./users'),
  admin: require('./admin'),
  devices: require('./devices'),
};
