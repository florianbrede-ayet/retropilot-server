const config = require('./../config');


module.exports = async (models, logger) => {


    return {
        authentication: require('./authentication')(models, logger),
        helpers: require('./helpers')(models, logger),
        storage: require('./storage')(models, logger),
        mailing: require('./mailing')(models, logger),
        users: require('./users')(models, logger),
        //admin: require('./admin')(models, logger)
    }

}
