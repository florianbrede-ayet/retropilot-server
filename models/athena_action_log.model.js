import { DataTypes } from 'sequelize';

export default (sequelize) => {
  sequelize.define('athena_action_log', {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER,
    },
    account_id: {
      allowNull: true,
      type: DataTypes.INTEGER,
    },
    device_id: {
      allowNull: true,
      type: DataTypes.INTEGER,
    },
    action: {
      allowNull: true,
      type: DataTypes.TEXT,
    },
    user_ip: {
      allowNull: true,
      type: DataTypes.TEXT,
    },
    device_ip: {
      allowNull: true,
      type: DataTypes.TEXT,
    },
    meta: {
      allowNull: true,
      type: DataTypes.TEXT,
    },
    created_at: {
      allowNull: true,
      type: DataTypes.BIGINT,
    },
    dongle_id: {
      allowNull: true,
      type: DataTypes.TEXT,
    },
  }, {
    timestamps: false,
  });
};
