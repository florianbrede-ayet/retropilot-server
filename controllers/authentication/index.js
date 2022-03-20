import crypto from 'crypto';
import jsonwebtoken from 'jsonwebtoken';
import log4js from 'log4js';
import orm from '../../models/index.model';

const logger = log4js.getLogger('default');

export async function validateJWT(token, key) {
  try {
    return jsonwebtoken.verify(token.replace('JWT ', ''), key, { algorithms: ['RS256'], ignoreNotBefore: true });
  } catch (exception) {
    logger.warn(`failed to validate JWT ${exception}`);
  }
  return null;
}

export async function readJWT(token) {
  try {
    return jsonwebtoken.decode(token);
  } catch (exception) {
    logger.warn(`failed to read JWT ${exception}`);
  }
  return null;
}

async function signIn(email, password) {
  let account = await orm.models.accounts.findOne({ where: { email } });

  if (account && account.dataValues) {
    account = account.dataValues;
    const inputPassword = crypto.createHash('sha256').update(password + process.env.APP_SALT).digest('hex');
    if (account.password === inputPassword) {
      const token = jsonwebtoken.sign({ accountId: account.id }, process.env.APP_SALT);

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
  const oldPasswordHash = crypto.createHash('sha256').update(oldPassword + process.env.APP_SALT).digest('hex');

  if (account.password === oldPasswordHash) {
    const newPasswordHash = crypto.createHash('sha256').update(newPassword + process.env.APP_SALT).digest('hex');

    await orm.models.accounts.update(
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

async function getAuthenticatedAccount(req) {
  const sessionJWT = req.cookies.jwt;
  if ((!sessionJWT || sessionJWT.expires <= Date.now())) {
    return null;
  }

  return getAccountFromJWT(sessionJWT);
}

async function getAccountFromJWT(jwt, limitData) {
  let token;

  try {
    token = jsonwebtoken.verify(jwt, process.env.APP_SALT);
  } catch (err) {
    return null;// {success: false, msg: 'BAD_JWT'}
  }

  if (!token || !token.accountId) {
    return null; // {success: false, badToken: true}
  }

  let query = { where: { id: token.accountId } };
  if (limitData) {
    query = { ...query, attributes: { exclude: ['password', '2fa_token', 'session_seed'] } };
  }

  const account = await orm.models.accounts.findOne(query);
  if (!account.dataValues) {
    return null; // {success: false, isInvalid: true}
  }

  try {
    await orm.models.accounts.update(
      { last_ping: Date.now() },
      { where: { id: account.id } },
    );
  } catch (error) {
    console.log(error);
  }

  if (!account || account.banned) {
    return null; // {success: false, isBanned: true}
  }
  return account;
}

export default {
  validateJWT,
  getAuthenticatedAccount,
  changePassword,
  signIn,
  readJWT,
  getAccountFromJWT,
};
