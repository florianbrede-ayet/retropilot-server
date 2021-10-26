const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
	sequelize.define('device_authorised_users', {
		id: {
			allowNull: false,
			autoIncrement: true,
			primaryKey: true,
			type: DataTypes.INTEGER
		},
        account_id: {
			allowNull: false,
			type: DataTypes.INTEGER
		},
        device_id: {
			allowNull: true,
			type: DataTypes.INTEGER
		},
        athena: {
			allowNull: true,
			type: DataTypes.INTEGER
		},
        unpair: {
			allowNull: true,
			type: DataTypes.INTEGER
		},
        view_drives: {
			allowNull: true,
			type: DataTypes.INTEGER
		},
		created_at: {
			allowNull: true,
			type: DataTypes.INTEGER
		},

	}, {
		timestamps: false,
	});
};