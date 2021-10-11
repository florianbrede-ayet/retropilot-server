const config = require('./../config');


module.exports = async (models, logger, models_sqli) => {


    return {
        authentication: require('./authentication'),
        helpers: require('./helpers')(models, logger),
        storage: require('./storage')(models, logger),
        mailing: require('./mailing')(models, logger),
        users: require('./users')(models, logger),
        admin: require('./admin'),
        devices: require('./devices')
    }

}
