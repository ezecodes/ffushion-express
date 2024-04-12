import sequelize from "./models/index.js";

async function connect() {
  try {
    await sequelize.authenticate();
    console.info("PG connected");
    await sequelize.query("CREATE EXTENSION IF NOT EXISTS vector");
  } catch (err) {
    console.error("PG failed");
    console.error(err);
    process.exit(1);
  }
}
export default connect;
