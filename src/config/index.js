import dotenv from "dotenv";
dotenv.config();
const database = {
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  dialect: "postgres",
  port: process.env.DB_PORT,
  host: process.env.DB_HOST,
};

const AI_API_TOKEN = process.env.AI_API_TOKEN;
const ACCOUNT_ID = process.env.ACCOUNT_ID;

export { database, AI_API_TOKEN, ACCOUNT_ID };
