import { DataTypes } from 'sequelize';

export default (sequelize) => {
  sequelize.define(
    'oauth_accounts',
    {
      id: {
        id: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER,
      },
      account_id: {
        allowNull: false,
        type: DataTypes.INTEGER,
      },
      email: {
        allowNull: false,
        type: DataTypes.TEXT,
      },
      created: {
        allowNull: true,
        type: DataTypes.TIME,
      },
      last_used: {
        allowNull: true,
        type: DataTypes.CHAR,
      },
      refresh: {
        allowNull: true,
        type: DataTypes.TEXT,
      },
      provider: {
        allowNull: true,
        type: DataTypes.TEXT,
      },
    },
    {
      timestamps: false,
    },
  );
};
