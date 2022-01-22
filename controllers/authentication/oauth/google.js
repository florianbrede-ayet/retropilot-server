import jsonwebtoken from 'jsonwebtoken';
import { ClientCredentials, ResourceOwnerPassword, AuthorizationCode } from 'simple-oauth2';
import log4js from 'log4js';
import { AUTH_OAUTH_ERR_GOOGLE, AUTH_OAUTH_ERR_GOOGLE_FAILED_TOKEN_FETCH } from '../../../consistency/terms';

const logger = log4js.getLogger('default');

const keys = {
  web: {
    client_id: '816666184056-n2cpdtsf2v9iiv81ro80cckl5f4oi4p8.apps.googleusercontent.com', project_id: 'glassy-tube-338505', auth_uri: 'https://accounts.google.com/o/oauth2/auth', token_uri: 'https://oauth2.googleapis.com/token', auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs', client_secret: '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', redirect_uris: ['http://localhost/authentication/oauth/callback'], javascript_origins: ['http://localhost'],
  },
};

const config = {
  client: {
    id: keys.web.client_id,
    secret: keys.web.client_secret,
  },
  auth: {
    // token server
    tokenHost: 'https://oauth2.googleapis.com',
    tokenPath: '/token',

    // authorization server
    authorizeHost: 'https://accounts.google.com',
    authorizePath: '/o/oauth2/v2/auth',
  },
};

export async function getToken(code, scope) {
  const client = new AuthorizationCode(config);

  const tokenParams = {
    code,
    redirect_uri: 'http://localhost/authentication/oauth/callback',
    scope,
  };

  let accessToken;

  try {
    accessToken = await client.getToken(tokenParams);
  } catch (error) {
    logger.warn(AUTH_OAUTH_ERR_GOOGLE, AUTH_OAUTH_ERR_GOOGLE_FAILED_TOKEN_FETCH, error);
    return { error: true, ...AUTH_OAUTH_ERR_GOOGLE_FAILED_TOKEN_FETCH };
  }

  console.log(accessToken);

  const id = jsonwebtoken.decode(accessToken.token.id_token);

  console.log(id);

  return id;
}

export async function getURL() {
  const client = new AuthorizationCode(config);

  return client.authorizeURL({
    redirect_uri: 'http://localhost/authentication/oauth/callback',
    scope: 'https://www.googleapis.com/auth/userinfo.email',
    state: 'ada',
  });
}

export default {
  getToken,
  getURL,
};
