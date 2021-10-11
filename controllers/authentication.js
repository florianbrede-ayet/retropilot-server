const jwt = require('jsonwebtoken');
let logger;
const models_orm = require('./../models/index.model')
const crypto = require('crypto');
const config = require('./../config')

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

async function signIn(email, password) {

    let account = await models_orm.models.accounts.findOne({where: {email: email}});


    if (account.dataValues) {
        account = account.dataValues;

        const inputPassword = crypto.createHash('sha256').update(password + config.applicationSalt).digest('hex');

        if (account.password === inputPassword) {
            const token = jwt.sign({accountId: account.id}, config.applicationSalt)
            return {success: true, jwt: token};
        } else {
            return {success: false, msg: 'BAD PASSWORD', invalidPassword: true}
        }
    } else {
        return {success: false, msg: 'BAD ACCOUNT', badAccount: true}
    }
}


async function changePassword(account, newPassword, oldPassword) {
    if (!account || !newPassword || !oldPassword) { return {success: false, error: 'MISSING_DATA'}}
    const oldPasswordHash = crypto.createHash('sha256').update(oldPassword + config.applicationSalt).digest('hex')

    if (account.password === oldPasswordHash) {
        const newPasswordHash = crypto.createHash('sha256').update(newPassword + config.applicationSalt).digest('hex')

        const update = models_orm.models.accounts.update(
            { password: newPasswordHash },
            { where: { id: account.id } }
        )

        return {success: true, msg: 'PASSWORD CHANGED', changed: true}
    } else {
        return {success: false, msg: 'BAD PASSWORD', passwordCorrect: false}
    }
}

/*
 TODO: update rest of the code to support authentication rejection reasons
*/

async function getAuthenticatedAccount(req, res) {
    const sessionJWT = (req.signedCookies !== undefined ? req.signedCookies.jwt : null)
    if ((!sessionJWT || sessionJWT.expires <= Date.now())) { return null; }
    const token = jwt.verify(sessionJWT, config.applicationSalt);

    if (token && token.accountId) {
        const account = await models_orm.models.accounts.findOne({where: {id: token.accountId}});

        if (account.dataValues) {
            const update = models_orm.models.accounts.update({ last_ping: Date.now() },
                { where: { id: account.id } }
            )

            if (!account || account.banned) {
                return null; // {success: false, isBanned: true}
            }
            return account;
        } else {
            return null; // {success: false, isInvalid: true}
        }
    } else {
        return null; // {success: false, badToken: true}
    }

    return null;

    
}



module.exports = {
    validateJWT: validateJWT,
    getAuthenticatedAccount: getAuthenticatedAccount,
    changePassword: changePassword,
    signIn: signIn
}