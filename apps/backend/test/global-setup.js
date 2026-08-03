const { execSync } = require("child_process");
const dotenv = require("dotenv");
const path = require("path");

module.exports = async function globalSetup() {
  dotenv.config({ path: path.resolve(__dirname, "../.env.test") });
  execSync("npx prisma migrate deploy", {
    cwd: path.resolve(__dirname, ".."),
    env: process.env,
    stdio: "inherit",
  });
};
