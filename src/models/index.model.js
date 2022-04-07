/* eslint-disable no-restricted-syntax */
/* eslint-disable global-require */

import { Sequelize } from 'sequelize';

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
  require('./devices.model').default,
  require('./drives.model').default,
  require('./accounts.model').default,
  require('./athena_action_log.model').default,
  require('./athena_returned_data.model').default,
  require('./device_authorised_users.model').default,
  require('./drive_segments.model').default,
  require('./oauth_accounts.model').default,
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
