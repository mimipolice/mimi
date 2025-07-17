import { Pool } from 'pg';
import logger from '../../../utils/logger';

export async function up(db: Pool): Promise<void> {
  try {
    await db.query(`
      ALTER TABLE tickets ADD COLUMN "transcriptUrl" VARCHAR(2048) NULL;
    `);

    logger.info('Migration 003_add_transcript_url completed successfully.');
  } catch (error) {
    logger.error('Error running migration 003_add_transcript_url:', error);
    throw error;
  }
}
