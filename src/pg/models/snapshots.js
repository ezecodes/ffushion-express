import { DataTypes } from "sequelize";
import sequelize from "./index.js";

const Snapshots = sequelize.define(
  "snapshots",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      primaryKey: true,
    },
    description: DataTypes.STRING,
    path: DataTypes.STRING,
    videoId: DataTypes.STRING,
    timeCaptured: DataTypes.DATE,
    playbackTime: DataTypes.STRING,
    classified: DataTypes.JSON,
    embedding: {
      type: DataTypes.VECTOR(768),
    },
  },
  {
    tableName: "snapshots",
  }
);

export default Snapshots;
