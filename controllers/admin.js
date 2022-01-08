const crypto = require('crypto');
const config = require('../config');
const models_orm = require('../models/index.model');

let models;
let logger;

// TODO move everythijng away from this dumb intertwined style

const devices = require('./devices');
const authentication = require('./authentication');

async function isCurrentUserAdmin(hardFail, req) {
  const account = await authentication.getAuthenticatedAccount(req);
  if (!account) return { isAdmin: false, account };
  if (account.admin !== 1) {
    return { isAdmin: false, account };
  }

  return { isAdmin: true, account };
}

async function banAccount(ban, userId) {
  if (!userId || !ban) return { success: false, status: 400, data: { bad_data: true } };
  let cleanBan;
  if (ban === 'true' || ban === 'false') {
    cleanBan = ban === 'true';
  }
  else {
    return { success: false, status: 400, data: { bad_data: true } };
  }

  const update = await models_orm.models.accounts.update(
    { banned: cleanBan ? 1 : 0 },
    { where: { id: userId } }
  );

  const verify = await models_orm.models.accounts.findOne({ where: { id: userId } });

  if (verify.dataValues && verify.dataValues.banned === cleanBan ? 1 : 0) {
    return { success: true, status: 200, data: { banned: ban } };
  }
  return { success: false, status: 500, data: { banned: false } };
}

module.exports = {
  banAccount,
  isCurrentUserAdmin
};
