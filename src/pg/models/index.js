import { Sequelize } from "sequelize";
import { PG } from "../../config/index.js";
import pgvector from "pgvector/sequelize";
pgvector.registerType(Sequelize);

const sequelize = new Sequelize(
  `postgres://${PG.username}:${PG.password}@${PG.host}:${PG.port}/${PG.database}`,
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

// sequelize.sync({ alter: false, force: true }).then(async () => {
//   console.log("Re-sync done");
// });

export default sequelize;
