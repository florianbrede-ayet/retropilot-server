import { DataTypes } from 'sequelize';

export default (sequelize) => {
  sequelize.define('accounts', {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER,
    },
    email: {
      allowNull: false,
      type: DataTypes.TEXT,
    },
    password: {
      allowNull: true,
      type: DataTypes.TEXT,
    },
    created: {
      allowNull: true,
      type: DataTypes.INTEGER,
    },
    last_ping: {
      allowNull: true,
      type: DataTypes.INTEGER,
    },
    '2fa_token': {
      allowNull: true,
      type: DataTypes.TEXT,
    },
    admin: {
      allowNull: true,
      type: DataTypes.BOOLEAN,
    },
    email_verify_token: {
      allowNull: true,
      type: DataTypes.TEXT,
    },
    g_oauth_sub: {
      allowNull: true,
      type: DataTypes.TEXT,
    },
    two_factor_enabled: {
      allowNull: true,
      type: DataTypes.BOOLEAN,
    },
  }, {
    timestamps: false,
  });
};
