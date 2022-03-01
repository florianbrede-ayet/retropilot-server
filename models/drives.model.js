import { DataTypes } from 'sequelize';

export default (sequelize) => {
  sequelize.define(
    'drives',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER,
      },
      identifier: {
        allowNull: false,
        type: DataTypes.TEXT,
      },
      dongle_id: {
        allowNull: true,
        type: DataTypes.TEXT,
      },
      max_segment: {
        allowNull: true,
        type: DataTypes.INTEGER,
      },
      upload_complete: {
        allowedNull: true,
        type: DataTypes.BOOLEAN,
      },
      duration: {
        allowNull: true,
        type: DataTypes.INTEGER,
      },
      distance_meters: {
        allowNull: true,
        type: DataTypes.INTEGER,
      },
      filesize: {
        allowNull: true,
        type: DataTypes.INTEGER,
      },
      is_processed: {
        allowNull: true,
        type: DataTypes.BOOLEAN,
      },
      created: {
        allowNull: true,
        type: DataTypes.INTEGER,
      },
      last_upload: {
        allowNull: true,
        type: DataTypes.INTEGER,
      },
      is_preserved: {
        allowNull: true,
        type: DataTypes.BOOLEAN,
      },
      is_deleted: {
        allowNull: true,
        type: DataTypes.BOOLEAN,
      },
      drive_date: {
        allowNull: true,
        type: DataTypes.INTEGER,
      },
      is_physically_removed: {
        allowNull: true,
        type: DataTypes.BOOLEAN,
      },
      metadata: {
        allowNull: true,
        type: DataTypes.TEXT,
      },
    },
    {
      timestamps: false,
    },
  );
};
