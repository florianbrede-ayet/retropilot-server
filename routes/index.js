/* eslint-disable global-require */
module.exports = {
  useradmin: require('./useradmin')(_models, _controllers, _logger),
  api: require('./api'),
  useradminapi: require('./userAdminApi'),
  admin: require('./administration/adminApi'),
  realtime: require('./api/realtime'),

  deviceApi: require('./api/devices'),
  authenticationApi: require('./api/authentication'),
};
