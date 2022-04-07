import { AUTH_REGISTER_OAUTH_NO_EMAIL, AUTH_REGISTER_ALREADY_REGISTERED } from '../../consistency/terms';
import { getAccountFromEmail } from '../users';

export function oauthRegister(email) {
  if (!email) return { error: true, ...AUTH_REGISTER_OAUTH_NO_EMAIL };

  const account = getAccountFromEmail(email);

  if (account) return { error: true, ...AUTH_REGISTER_ALREADY_REGISTERED };

  // TODO: finish
  return { error: false };
}

export default function register() {

}
