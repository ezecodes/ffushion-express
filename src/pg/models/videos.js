import { DataTypes } from "sequelize";
import sequelize from "./index.js";

const Videos = sequelize.define(
  "videos",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      primaryKey: true,
    },
    path: DataTypes.STRING,
    name: DataTypes.STRING,
    type: DataTypes.STRING,
    size: DataTypes.DATE,
    duration: DataTypes.STRING,
    userId: DataTypes.JSON,
  },
  {
    tableName: "videos",
  }
);

export default Videos;
