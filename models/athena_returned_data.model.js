import { DataTypes } from 'sequelize';

export default (sequelize) => {
  sequelize.define('athena_returned_data', {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER,
    },
    device_id: {
      allowNull: true,
      type: DataTypes.INTEGER,
    },
    type: {
      allowNull: true,
      type: DataTypes.TEXT,
    },
    data: {
      allowNull: true,
      type: DataTypes.TEXT,
    },
    created_at: {
      allowNull: true,
      type: DataTypes.TEXT,
    },
    uuid: {
      allowNull: false,
      type: DataTypes.TEXT,
    },
    resolved_at: {
      allowNull: true,
      type: DataTypes.INTEGER,
    },

  }, {
    timestamps: false,
  });
};
