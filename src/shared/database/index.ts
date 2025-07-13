import { Pool } from "pg";
import fs from "fs";
import path from "path";
import config from "../../config";

const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  user: config.database.user,
  password: config.database.password,
  database: config.database.name,
});

async function initializeDatabase() {
  try {
    const schemaPath = path.join(__dirname, "schema.sql");
    const schemaSQL = fs.readFileSync(schemaPath, "utf-8");
    await pool.query(schemaSQL);
    console.log("Database schema initialized successfully.");
  } catch (error) {
    console.error("Error initializing database schema:", error);
  }
}

pool.on("connect", () => {
  console.log("Database connected");
  initializeDatabase();
});

pool.on("error", (err) => {
  console.error("Database connection error", err.stack);
});

// Test the connection
pool.connect((err, client, done) => {
  if (err) {
    console.error("Database connection test failed", err.stack);
    return;
  }
  console.log("Database connection test successful");
  if (done) {
    done();
  }
});

export default pool;
