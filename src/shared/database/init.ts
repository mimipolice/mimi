import { Pool } from 'pg';
import logger from '../../utils/logger';

export async function initDatabase() {
  const dbName = process.env.DB_NAME;

  if (!dbName) {
    logger.error('DB_NAME environment variable is not set.');
    process.exit(1);
  }

  const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: 'postgres', // Connect to the default 'postgres' database to check for existence
  });

  try {
    const client = await pool.connect();
    try {
      const res = await client.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [dbName]);
      if (res.rowCount === 0) {
        logger.info(`Database "${dbName}" does not exist. Creating it...`);
        await client.query(`CREATE DATABASE "${dbName}"`);
        logger.info(`Database "${dbName}" created successfully.`);
      } else {
        logger.info(`Database "${dbName}" already exists.`);
      }
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Error initializing database:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}
