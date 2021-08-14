const config = require('./../config');
const crypto = require('crypto');

let models;
let logger;


async function getAccountFromId(id) {
    return await models.users.getAccountFromId(id);
}

async function createAccount(email, password) {
    if (!email || !password) return {success: false, status: 400, data: {missingData: true}};
    if (!config.allowAccountRegistration) {
        return {success: false, status: 403, data: {registerEnabled: false}}
    }
    const emailToken = crypto.createHmac('sha256', config.applicationSalt).update(email.trim()).digest('hex');
    password = crypto.createHash('sha256').update(password + config.applicationSalt).digest('hex');

    if (await models.users.getAccountFromEmail(email) != null) {
        return {success: true, status: 409, data: {alreadyRegistered: true}};
    }

    const registerAction = await models.users.createUser(email, password, Date.now(), Date.now(), emailToken)

    const didAccountRegister = await models.users.getAccountFromEmail(email);

    if (didAccountRegister != null) {
        return {success: true, status, status: 200}
    }
}

async function verifyEmailToken(token) {
    if (!token) return {success: false, status: 400, data: {missingToken: true}}

    const account = await models.users.getAccountFromVerifyToken(token);
    if (account === null) return {success: false, status: 404, data: {badToken: true}}
    if (account.verified === 1) return {success: true, status: 404, data: {alreadyVerified: true}}

    const verified = await models.users.verifyAccountEmail(account.email, true, null);
    return {success: true, status: 200, data: {successfullyVerified: true}}
}



module.exports = (_models, _logger) => {
    models = _models;
    logger = _logger;

    return {
        createAccount,
        verifyEmailToken,
        getAccountFromId
    }
}
