import { DataTypes } from 'sequelize';

export default (sequelize) => {
  sequelize.define(
    'drive_segments',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER,
      },
      segment_id: {
        allowNull: false,
        type: DataTypes.INTEGER,
      },
      drive_identifier: {
        allowNull: true,
        type: DataTypes.TEXT,
      },
      dongle_id: {
        allowNull: true,
        type: DataTypes.TEXT,
      },
      duration: {
        allowedNull: true,
        type: DataTypes.INTEGER,
      },
      distance_meters: {
        allowNull: true,
        type: DataTypes.INTEGER,
      },
      upload_complete: {
        allowNull: true,
        type: DataTypes.BOOLEAN,
      },
      is_processed: {
        allowNull: true,
        type: DataTypes.BOOLEAN,
      },
      is_stalled: {
        allowNull: true,
        type: DataTypes.BOOLEAN,
      },
      created: {
        allowNull: true,
        type: DataTypes.INTEGER,
      },
      process_attempts: {
        allowNull: true,
        type: DataTypes.INTEGER,
      },
    },
    {
      timestamps: false,
    },
  );
};
