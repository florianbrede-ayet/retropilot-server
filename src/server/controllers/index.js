/* eslint-disable global-require, no-unused-vars */
import authentication from './authentication';
import helpers from './helpers';
import storage from './storage';
import mailing from './mailing';
import users from './users';
import admin from './admin';
import devices from './devices';

// TO DO, finish up removing this callback stuff
export default {
  authentication,
  helpers,
  storage,
  mailing,
  users,
  admin,
  devices,
};
