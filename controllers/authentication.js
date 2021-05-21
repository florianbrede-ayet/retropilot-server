
const jwt = require('jsonwebtoken');
let models;
let logger;


async function validateJWT(token, key) {
    try {
        return jwt.verify(token.replace("JWT ", ""), key, {algorithms: ['RS256']});
    } catch (exception) {
        // TODO add logger to authentication controller
        //logger.error(exception);
    }
    return null;
}


async function getAuthenticatedAccount(req, res) {
    const sessionCookie = (req.signedCookies !== undefined ? req.signedCookies.session : null);
    if (!sessionCookie || sessionCookie.expires <= Date.now()) { return null; }
    const email = sessionCookie.account.trim().toLowerCase();


    // don't need to wait for this, logging a ping if a banned user attempts to sign in

    // TODO stop storing emails in the cookie
    const account = await models.users.getAccountFromEmail(email)

    if (!account || account.banned) {
        res ? res.clearCookie('session') : logger.warn(`getAuthenticatedAccount unable to clear banned user (${account.email}) cookie, res not passed`);
        return null;
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
