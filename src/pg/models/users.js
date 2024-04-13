import { DataTypes } from "sequelize";
import sequelize from "./index.js";

const Users = sequelize.define(
  "users",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      primaryKey: true,
    },
    email: DataTypes.STRING,
    password: DataTypes.STRING,
  },
  {
    tableName: "users",
  }
);

export default Users;
