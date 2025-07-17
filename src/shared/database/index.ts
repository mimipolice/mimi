import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import logger from '../../utils/logger';

export const runMigrations = async (pool: Pool) => {
  const migrationFolder = path.join(__dirname, 'migrations');

  try {
    // Ensure the schema_migrations table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY
      );
    `);

    const migrations = fs.readdirSync(migrationFolder).sort();
    for (const migrationFile of migrations) {
      const { rows: [appliedMigration] } = await pool.query(
        'SELECT version FROM schema_migrations WHERE version = $1',
        [migrationFile]
      );

      if (appliedMigration) {
        continue;
      }

      const migration = await import(path.join(migrationFolder, migrationFile));
      if (typeof migration.up !== 'function') {
        logger.warn(`Migration ${migrationFile} does not have an 'up' function.`);
        continue;
      }
      
      await migration.up(pool);

      await pool.query('INSERT INTO schema_migrations (version) VALUES ($1)', [
        migrationFile,
      ]);
      
      logger.info(`Migration ${migrationFile} executed successfully.`);
    }

    logger.info('Database migrations completed successfully.');
  } catch (error) {
    logger.error('Database migration failed:', error);
    throw error;
  }
};
