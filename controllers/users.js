const crypto = require('crypto');
const config = require('../config');
const orm = require('../models/index.model');

async function getAccountFromId(id) {
  return orm.models.accounts.findByPk(id);
}

async function createAccount(email, password) {
  if (!email || !password) {
    return { success: false, status: 400, data: { missingData: true } };
  }
  if (!config.allowAccountRegistration) {
    return { success: false, status: 403, data: { registerEnabled: false } };
  }

  const emailToken = crypto.createHmac('sha256', config.applicationSalt).update(email.trim()).digest('hex');
  password = crypto.createHash('sha256').update(password + config.applicationSalt).digest('hex');

  const account = await orm.models.accounts.findOne({ where: { email } });
  if (account != null && account.dataValues != null) {
    return { success: true, status: 409, data: { alreadyRegistered: true } };
  }

  await orm.models.accounts.create({
    email,
    password,
    created: Date.now(),
    last_ping: Date.now(),
    email_verify_token: emailToken,
  });

  const didAccountRegister = await orm.models.accounts.findOne({ where: { email } });

  if (didAccountRegister != null && didAccountRegister.dataValues != null) {
    return { success: true, status: 200 };
  }

  // TODO: better error
  return { success: false, status: 500, data: {} };
}

async function verifyEmailToken(token) {
  if (!token) {
    return { success: false, status: 400, data: { missingToken: true } };
  }

  const account = await orm.models.accounts.findOne(
    { where: { email_verify_token: token } },
  );

  if (account === null) {
    return { success: false, status: 404, data: { badToken: true } };
  }
  if (account.verified === 1) {
    return { success: true, status: 404, data: { alreadyVerified: true } };
  }

  await orm.models.accounts.update(
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
  return orm.models.accounts.findAll({ attributes: ['id', 'last_ping', 'created', 'admin', 'banned'] });
}

module.exports = {
  createAccount,
  verifyEmailToken,
  getAccountFromId,
  getAllUsers,
};
