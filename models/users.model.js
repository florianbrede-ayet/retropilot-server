const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
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
      type: DataTypes.INTEGER,
    },
    created: {
      allowNull: true,
      type: DataTypes.NUMBER,
    },
    last_ping: {
      allowNull: true,
      type: DataTypes.NUMBER,
    },
    '2fa_token': {
      allowNull: true,
      type: DataTypes.TEXT,
    },
    admin: {
      allowNull: true,
      type: DataTypes.INTEGER,
    },
  }, {
    timestamps: false,
  });
};
