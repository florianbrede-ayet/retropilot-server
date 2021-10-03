const jwt = require('jsonwebtoken');
let models;
let logger;
const models_orm = require('./../models/index.model')


async function validateJWT(token, key) {
    try {
        return jwt.verify(token.replace("JWT ", ""), key, {algorithms: ['RS256'], ignoreNotBefore: true});
    } catch (exception) {
        logger.warn(`failed to validate JWT ${exception}`)
    }
    return null;
}

async function readJWT(token) {
    try {
        return jwt.decode(token);
    } catch (exception) {
        logger.warn(`failed to read JWT ${exception}`)
    }
    return null;
}




async function getAuthenticatedAccount(req, res) {
    const sessionCookie = (req.signedCookies !== undefined ? req.signedCookies.session : null);
    if (!sessionCookie || sessionCookie.expires <= Date.now()) { return null; }
    const email = sessionCookie.account.trim().toLowerCase();



    // TODO stop storing emails in the cookie
    const account = await models_orm.models.accounts.findOne({where: {email: email}});

    if (account.dataValues) {
        const update = models_orm.models.accounts.update({ last_ping: Date.now() },
            { where: { id: account.id } }
        )


        if (!account || account.banned) {
            res ? res.clearCookie('session') : logger.warn(`getAuthenticatedAccount unable to clear banned user (${account.email}) cookie, res not passed`);
            return false
        }
        return account;
    } else {
        res ? res.clearCookie('session') : logger.warn(`getAuthenticatedAccount unable to clear banned user (${account.email}) cookie, res not passed`);
        return false;
    }
}


module.exports = (_models, _logger) => {
    models = _models;
    logger = _logger;

    return {
        validateJWT: validateJWT,
        getAuthenticatedAccount: getAuthenticatedAccount
    }
}
