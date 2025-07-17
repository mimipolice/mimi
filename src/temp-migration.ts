import 'dotenv/config';
import { Pool } from 'pg';
import logger from './utils/logger.js';

async function runMigration() {
  const db = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    await db.query('ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS "archiveCategoryId" VARCHAR(255) NULL;');
    logger.info('Migration successful: "archiveCategoryId" column added to guild_settings table.');
  } catch (error) {
    logger.error('Migration failed:', error);
  } finally {
    await db.end();
    process.exit(0);
  }
}

runMigration();
