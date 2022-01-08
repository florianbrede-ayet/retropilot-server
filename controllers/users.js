const crypto = require('crypto');
const config = require('../config');
const models_orm = require('../models/index.model');
const authentication = require('./authentication');

async function getAccountFromId(id) {
  return await models_orm.models.accounts.findByPk(id);
}

async function createAccount(email, password) {
  if (!email || !password) return { success: false, status: 400, data: { missingData: true } };
  if (!config.allowAccountRegistration) {
    return { success: false, status: 403, data: { registerEnabled: false } };
  }
  const emailToken = crypto.createHmac('sha256', config.applicationSalt).update(email.trim()).digest('hex');
  password = crypto.createHash('sha256').update(password + config.applicationSalt).digest('hex');

  const account = await models_orm.models.accounts.findOne({ where: { email } });
  if (account != null && account.dataValues != null) {
    return { success: true, status: 409, data: { alreadyRegistered: true } };
  }

  const registerAction = await models_orm.models.accounts.create({
    email,
    password,
    created: Date.now(),
    last_ping: Date.now(),
    email_verify_token: emailToken,
  });

  const didAccountRegister = await models_orm.models.accounts.findOne({ where: { email } });

  if (didAccountRegister != null && didAccountRegister.dataValues != null) {
    return { success: true, status: 200 };
  }
}

async function verifyEmailToken(token) {
  if (!token) return { success: false, status: 400, data: { missingToken: true } };
  const account = await models_orm.models.accounts.findOne(
    { where: { email_verify_token: token } },
  );

  if (account === null) return { success: false, status: 404, data: { badToken: true } };
  if (account.verified === 1) {
    return { success: true, status: 404, data: { alreadyVerified: true } };
  }

  const update = models_orm.models.accounts.update(
    {
      verified: true,
    },
    {
      where: {
        id: account.id,
      },
    },
  );

  return { success: true, status: 200, data: { successfullyVerified: true } };
}

async function getAllUsers() {
  const users = await models_orm.models.accounts.findAll({ attributes: ['id', 'last_ping', 'created', 'admin', 'banned'] });
  return users;
}

module.exports = {
  createAccount,
  verifyEmailToken,
  getAccountFromId,
  getAllUsers,
};
