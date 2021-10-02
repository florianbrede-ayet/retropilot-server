
const jwt = require('jsonwebtoken');
let models;
let logger;


async function validateJWT(token, key) {
    try {
        return jwt.verify(token.replace("JWT ", ""), key, {algorithms: ['RS256']});
    } catch (exception) {
        logger.warn(`failed to validate JWT error: ${exception}`)
    }
    return null;
}

async function readJWT(token) {
    try {
        return jwt.decode(key);
    } catch (exception) {
        logger.warn(`failed to read JWT error: ${exception}`)
    }
    return null;
}



async function getAuthenticatedAccount(req, res) {
    const sessionCookie = (req.signedCookies !== undefined ? req.signedCookies.session : null);
    if (!sessionCookie || sessionCookie.expires <= Date.now()) { return null; }
    const email = sessionCookie.account.trim().toLowerCase();



    // TODO stop storing emails in the cookie
    const account = await models.users.getAccountFromEmail(email)
    // Don't really care about this returning.
    models.users.userPing(account.email);

    if (!account || account.banned) {
        res ? res.clearCookie('session') : logger.warn(`getAuthenticatedAccount unable to clear banned user (${account.email}) cookie, res not passed`);
        return false
    }
    return account;
}


module.exports = (_models, _logger) => {
    models = _models;
    logger = _logger;

    return {
        validateJWT: validateJWT,
        getAuthenticatedAccount: getAuthenticatedAccount
    }
}
