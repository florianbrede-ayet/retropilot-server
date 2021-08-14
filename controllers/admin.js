const config = require('./../config');
const crypto = require('crypto');

let models;
let logger;
let controllers;

async function isCurrentUserAdmin(req) {

}


async function banAccount(ban, user) {
    if (!user || !ban) return {success: false, status: 400, data: {bad_data: true}}

    const banQuery = await models.users.banAccount(ban, user.id);
    const account = await models.users.getAccountFromId(user.id)
    if (account.banned === ban ? 1 : 0) {
        return {success: true, status: 200, data: {banned: ban}}
    }
}



module.exports = (_models, _logger, _controllers) => {
    models = _models;
    logger = _logger;
    controllers = _controllers

    return {
        banAccount
    }
}
