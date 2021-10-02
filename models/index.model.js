const { Sequelize } = require('sequelize');
const sequelize = new Sequelize({
	dialect: 'sqlite',
	storage: 'database.sqlite',
	logQueryParameters: true,
	benchmark: true
});

const modelDefiners = [
	require('./devices.model'),
	require('./drives.model'),
	require('./users.model'),
];

for (const modelDefiner of modelDefiners) {
	modelDefiner(sequelize);
}

module.exports = sequelize;
