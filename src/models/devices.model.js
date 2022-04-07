import { DataTypes } from 'sequelize';

export default (sequelize) => {
  sequelize.define(
    'device',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER,
      },
      dongle_id: {
        allowNull: false,
        type: DataTypes.TEXT,
      },
      account_id: {
        allowNull: true,
        type: DataTypes.INTEGER,
      },
      imei: {
        allowNull: true,
        type: DataTypes.TEXT,
      },
      serial: {
        allowNull: true,
        type: DataTypes.TEXT,
      },
      device_type: {
        allowNull: true,
        type: DataTypes.TEXT,
      },
      public_key: {
        allowNull: true,
        type: DataTypes.TEXT,
      },
      created: {
        allowNull: true,
        type: DataTypes.BIGINT,
      },
      last_ping: {
        allowNull: true,
        type: DataTypes.BIGINT,
      },
      storage_used: {
        allowNull: true,
        type: DataTypes.INTEGER,
      },
      max_storage: {
        allowNull: true,
        type: DataTypes.INTEGER,
      },
      ignore_uploads: {
        allowNull: true,
        type: DataTypes.BOOLEAN,
      },
      nickname: {
        allowNull: true,
        type: DataTypes.TEXT,
      },
    },
    {
      timestamps: false,
    },
  );
};
