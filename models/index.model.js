function log() {
return true;
}

const { Sequelize } = require('sequelize');
const sequelize = new Sequelize({
	dialect: 'sqlite',
	storage: 'database.sqlite',
	logging: () => {console.log("FUCK OFF")}
	
	
});

sequelize.options.logging = (eee) => {console.log("EEEEE")}

const modelDefiners = [
	require('./devices.model'),
	require('./drives.model'),
	require('./users.model'),
	require('./athena_action_log.model'),
	require('./athena_returned_data.model'),
	require('./device_authorised_users.model'),
];

for (const modelDefiner of modelDefiners) {
	modelDefiner(sequelize);
}

module.exports = sequelize;
