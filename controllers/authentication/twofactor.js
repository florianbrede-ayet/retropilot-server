import { generateSecret, verify } from '2fa-util';
import {
  AUTH_2FA_BAD_ACCOUNT,
  AUTH_2FA_ONBOARD_ALREADY_ENROLLED,
  AUTH_2FA_NOT_ENROLLED,
  AUTH_2FA_ENROLLED,
  AUTH_2FA_BAD_TOKEN,
} from '../../consistency/terms';
import orm from '../../models/index.model';

export async function twoFactorOnboard(account) {
  if (!account || !account.dataValues) { return { success: false, ...AUTH_2FA_BAD_ACCOUNT }; }
  if (account['2fa_token'] !== null) return { success: false, ...AUTH_2FA_ONBOARD_ALREADY_ENROLLED };

  const token = await generateSecret(account.email, config.enterprise.name);

  orm.models.account.update(
    { '2fa_token': token.secret },
    { id: account.id },
  );

  return token;
}

export async function twoFactorConfirm(account, token) {
  const isTokenValid = await verifyTwoFactor(account.id, token);

  if (isTokenValid) {
    orm.models.account.update(
      { two_factor_enabled: true },
      { id: account.id },
    );
    return {
      success: true,
      ...AUTH_2FA_ENROLLED,
    };
  }
  return {
    success: false,
    ...AUTH_2FA_BAD_TOKEN,
  };
}

export async function verifyTwoFactor(account, token) {
  if (!account || !account.dataValues) { return { success: false, ...AUTH_2FA_BAD_ACCOUNT }; }
  if (account['2fa_token'] !== null) return { success: false, ...AUTH_2FA_NOT_ENROLLED };

  const result = await verify(token, account['2fa_token']).catch(console.log);

  return result;
}

export default null;
