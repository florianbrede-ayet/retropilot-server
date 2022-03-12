/* eslint-disable no-restricted-syntax */
/* eslint-disable global-require */

import { Sequelize } from 'sequelize';
import devices from './devices.model';
import drives from './drives.model';
import accounts from './accounts.model';
import athena_action_log from './athena_action_log.model';
import athena_returned_data from './athena_returned_data.model';
import device_authorised_users from './device_authorised_users.model';
import drive_segments from './drive_segments.model';
import oauth_accounts from './oauth_accounts';

const sequelize = new Sequelize({
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME || 'retro-pilot',
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 5432,
  dialect: 'postgres',
});

sequelize.options.logging = () => {};

const modelDefiners = [
  devices,
  drives,
  accounts,
  athena_action_log,
  athena_returned_data,
  device_authorised_users,
  drive_segments,
  oauth_accounts,
];

for (const modelDefiner of modelDefiners) {
  modelDefiner(sequelize);
}

/**
 * Synchronise the database (create new tables) to match the models defined
 * above.
 *
 * WARNING: If force is set, sequelize will delete columns and create new ones
 *          if their types have changed!
 *          Use sequelize-cli and migrations instead!
 */
sequelize.sync({ force: process.env.DB_FORCE_SYNC });

export default sequelize;
