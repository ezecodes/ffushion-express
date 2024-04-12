import { Sequelize } from "sequelize";
import { database } from "../../config/index.js";
import pgvector from "pgvector/sequelize";
pgvector.registerType(Sequelize);

const sequelize = new Sequelize(
  `postgres://${database.username}:${database.password}@${database.host}:${database.port}/${database.database}`,
  {
    logging: process.env["NODE_ENV"] === "development" ? true : false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  }
);

export default sequelize;
