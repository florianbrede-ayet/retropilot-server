/* eslint-disable no-restricted-syntax */
/* eslint-disable global-require */

const { Sequelize } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'database.sqlite'
});

sequelize.options.logging = () => {};

const modelDefiners = [
  require('./devices.model'),
  require('./drives.model'),
  require('./users.model'),
  require('./athena_action_log.model'),
  require('./athena_returned_data.model'),
  require('./device_authorised_users.model')
];

for (const modelDefiner of modelDefiners) {
  modelDefiner(sequelize);
}

module.exports = sequelize;
