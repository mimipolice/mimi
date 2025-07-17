import { Pool } from 'pg';
import logger from '../../../utils/logger';

export async function up(db: Pool): Promise<void> {
  try {
    await db.query(`
      ALTER TABLE guild_settings
      ADD COLUMN "panelTitle" TEXT NULL,
      ADD COLUMN "panelDescription" TEXT NULL;
    `);

    logger.info('Migration 004_add_panel_messages completed successfully.');
  } catch (error) {
    logger.error('Error running migration 004_add_panel_messages:', error);
    throw error;
  }
}
