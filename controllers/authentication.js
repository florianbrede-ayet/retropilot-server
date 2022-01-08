const jsonwebtoken = require('jsonwebtoken');

let logger;
const crypto = require('crypto');
const models_orm = require('../models/index.model');
const config = require('../config');

async function validateJWT(token, key) {
  try {
    return jsonwebtoken.verify(token.replace('JWT ', ''), key, { algorithms: ['RS256'], ignoreNotBefore: true });
  } catch (exception) {
    console.log(`failed to validate JWT ${exception}`);
  }
  return null;
}

async function readJWT(token) {
  try {
    return jsonwebtoken.decode(token);
  } catch (exception) {
    logger.warn(`failed to read JWT ${exception}`);
  }
  return null;
}

async function signIn(email, password) {
  let account = await models_orm.models.accounts.findOne({ where: { email } });

  if (account.dataValues) {
    account = account.dataValues;
    const inputPassword = crypto.createHash('sha256').update(password + config.applicationSalt).digest('hex');
    if (account.password === inputPassword) {
      const token = jsonwebtoken.sign({ accountId: account.id }, config.applicationSalt);

      // TODO: INSECURE, DEBUG
      console.log('jwt: ', token);
      return { success: true, jwt: token };
    }
    return { success: false, msg: 'BAD PASSWORD', invalidPassword: true };
  }
  return { success: false, msg: 'BAD ACCOUNT', badAccount: true };
}

async function changePassword(account, newPassword, oldPassword) {
  if (!account || !newPassword || !oldPassword) {
    return { success: false, error: 'MISSING_DATA' };
  }
  const oldPasswordHash = crypto.createHash('sha256').update(oldPassword + config.applicationSalt).digest('hex');

  if (account.password === oldPasswordHash) {
    const newPasswordHash = crypto.createHash('sha256').update(newPassword + config.applicationSalt).digest('hex');

    const update = models_orm.models.accounts.update(
      { password: newPasswordHash },
      { where: { id: account.id } },
    );

    return { success: true, msg: 'PASSWORD CHANGED', changed: true };
  }
  return { success: false, msg: 'BAD PASSWORD', passwordCorrect: false };
}

/*
 TODO: update rest of the code to support authentication rejection reasons
*/

async function getAuthenticatedAccount(req, res) {
  const sessionJWT = req.cookies.jwt;
  if ((!sessionJWT || sessionJWT.expires <= Date.now())) {
    return null;
  }

  return await getAccountFromJWT(sessionJWT);
}

async function getAccountFromJWT(jwt, limitData) {
  let token;

  try {
    token = jsonwebtoken.verify(jwt, config.applicationSalt);
  } catch (err) {
    return null;// {success: false, msg: 'BAD_JWT'}
  }

  if (token && token.accountId) {
    let query = { where: { id: token.accountId } };
    if (limitData) query = { ...query, attributes: { exclude: ['password', '2fa_token', 'session_seed'] } };

    const account = await models_orm.models.accounts.findOne(query);

    if (account.dataValues) {
      const update = models_orm.models.accounts.update(
        { last_ping: Date.now() },
        { where: { id: account.id } },
      );

      if (!account || account.banned) {
        return null; // {success: false, isBanned: true}
      }
      return account;
    }
    return null; // {success: false, isInvalid: true}
  }
  return null; // {success: false, badToken: true}
}

module.exports = {
  validateJWT,
  getAuthenticatedAccount,
  changePassword,
  signIn,
  readJWT,
  getAccountFromJWT,
};
