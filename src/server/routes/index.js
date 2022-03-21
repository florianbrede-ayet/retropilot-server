/* eslint-disable global-require */

import useradmin from './useradmin';
import api from './api';
import useradminapi from './userAdminApi';
import admin from './administration/adminApi';
import realtime from './api/realtime';
import deviceApi from './api/devices';
import authenticationApi from './api/authentication';
import oauthAuthenticator from './api/authentication/oauth';

export default {
  useradmin,
  api,
  useradminapi,
  admin,
  realtime,
  deviceApi,
  authenticationApi,
  oauthAuthenticator,
};
