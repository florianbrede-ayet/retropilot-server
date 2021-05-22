



module.exports = (_models, _controllers, _logger) => {
    return {
        useradmin: require('./useradmin')(_models, _controllers, _logger),
        api: require('./api')(_models, _controllers, _logger)
    }
}