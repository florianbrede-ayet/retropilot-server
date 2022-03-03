import { DataTypes } from 'sequelize';

export default (sequelize) => {
  sequelize.define('device_authorised_users', {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER,
    },
    account_id: {
      allowNull: false,
      type: DataTypes.INTEGER,
    },
    device_id: {
      allowNull: true,
      type: DataTypes.INTEGER,
    },
    athena: {
      allowNull: true,
      type: DataTypes.BOOLEAN,
    },
    unpair: {
      allowNull: true,
      type: DataTypes.BOOLEAN,
    },
    view_drives: {
      allowNull: true,
      type: DataTypes.BOOLEAN,
    },
    created_at: {
      allowNull: true,
      type: DataTypes.BIGINT,
    },

  }, {
    timestamps: false,
  });
};
