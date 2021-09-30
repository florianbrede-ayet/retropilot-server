



module.exports = (_models, _controllers, _logger) => {
    return {
        useradmin: require('./useradmin')(_models, _controllers, _logger),
        api: require('./api')(_models, _controllers, _logger),
        //useradminapi: require('./userAdminApi')(_models, _controllers, _logger)
        //adminApi: require('./administration/adminApi')(_models, _controllers, _logger)
    }
}