/* eslint-disable global-require */
module.exports = (_models, _controllers, _logger) => ({
  useradmin: require('./useradmin')(_models, _controllers, _logger),
  api: require('./api')(_models, _controllers, _logger),
  useradminapi: require('./userAdminApi')(_models, _controllers, _logger),
  admin: require('./administration/adminApi')(_models, _controllers, _logger),
  realtime: require('./api/realtime'),

  deviceApi: require('./api/devices'),
  authenticationApi: require('./api/authentication'),
});
