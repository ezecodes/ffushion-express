import { database } from "./index.js";
module.exports = {
  development: {
    ...database,
  },
  test: {
    ...database,
  },
  production: {
    ...database,
  },
};
