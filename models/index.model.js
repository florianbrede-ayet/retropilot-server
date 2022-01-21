/* eslint-disable no-restricted-syntax */
/* eslint-disable global-require */

import { Sequelize } from 'sequelize';
import devices from './devices.model';
import drives from './drives.model';
import users from './users.model';
import athena_action_log from './athena_action_log.model';
import athena_returned_data from './athena_returned_data.model';
import device_authorised_users from './device_authorised_users.model';
import drive_segments from './drive_segments.model';
import oauth_accounts from './oauth_accounts';
import config from '../config';

const sequelize = new Sequelize({

  username: 'postgres',
  password: config.sqltemp,
  database: 'retro-dev',
  host: '127.0.0.1',
  port: 5432,
  dialect: 'postgres',

});

sequelize.options.logging = () => {};

const modelDefiners = [
  devices,
  drives,
  users,
  athena_action_log,
  athena_returned_data,
  device_authorised_users,
  drive_segments,
  oauth_accounts,
];

for (const modelDefiner of modelDefiners) {
  modelDefiner(sequelize);
}

// Create tables if they don't exist
// Update columns to match if the table already exists
sequelize.sync({ alter: true });

export default sequelize;
