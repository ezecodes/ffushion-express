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
    name: DataTypes.STRING,
    type: DataTypes.STRING,
    size: DataTypes.DATE,
    duration: DataTypes.STRING,
    userId: DataTypes.UUID,
    summary: DataTypes.TEXT,
    description: DataTypes.TEXT,
    embedding: {
      type: DataTypes.VECTOR(768),
    },
    analysisStatus: {
      type: DataTypes.ENUM("pending", "started", "done"),
      defaultValue: "pending",
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    tableName: "videos",
  }
);

export default Videos;
