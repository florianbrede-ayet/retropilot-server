const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
	sequelize.define('drives', {
		id: {
			allowNull: false,
			autoIncrement: true,
			primaryKey: true,
			type: DataTypes.INTEGER
		},
        identifier: {
			allowNull: false,
			type: DataTypes.TEXT
		},
        dongle_id: {
			allowNull: true,
			type: DataTypes.TEXT
		},
        max_segment: {
			allowNull: true,
			type: DataTypes.INTEGER
		},
        duration: {
			allowNull: true,
			type: DataTypes.NUMBER
		},
        distance_meters: {
			allowNull: true,
			type: DataTypes.NUMBER
		},
        filesize: {
			allowNull: true,
			type: DataTypes.INTEGER
		},
        upload_complete: {
			allowNull: true,
			type: DataTypes.BOOLEAN
		},
        is_processed: {
			allowNull: true,
			type: DataTypes.BOOLEAN
		},
        created: {
			allowNull: true,
			type: DataTypes.INTEGER
		},
        last_updated: {
			allowNull: true,
			type: DataTypes.INTEGER
		},
        is_preserved: {
			allowNull: true,
			type: DataTypes.BOOLEAN
		},
        is_deleted: {
			allowNull: true,
			type: DataTypes.BOOLEAN
		},
        drive_date: {
			allowNull: true,
			type: DataTypes.INTEGER
		},
        is_physically_removed: {
			allowNull: true,
			type: DataTypes.BOOLEAN
		},
        metadata: {
			allowNull: true,
			type: DataTypes.TEXT
		},
	});
};