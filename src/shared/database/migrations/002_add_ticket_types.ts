import { Pool } from 'pg';
import logger from '../../../utils/logger';

export async function up(db: Pool): Promise<void> {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS ticket_types (
          id SERIAL PRIMARY KEY,
          guild_id VARCHAR(255) NOT NULL,
          type_id VARCHAR(255) NOT NULL,
          label VARCHAR(100) NOT NULL,
          style VARCHAR(20) NOT NULL DEFAULT 'Secondary', -- 'Primary', 'Secondary', 'Success', 'Danger'
          emoji VARCHAR(255) NULL,
          UNIQUE (guild_id, type_id),
          CONSTRAINT fk_guild
              FOREIGN KEY(guild_id)
              REFERENCES guild_settings("guildId")
              ON DELETE CASCADE
      );
    `);

    await db.query(`
      ALTER TABLE tickets
      ADD COLUMN IF NOT EXISTS "ticketType" VARCHAR(255) NULL;
    `);

    logger.info('Migration 002_add_ticket_types completed successfully.');
  } catch (error) {
    logger.error('Error running migration 002_add_ticket_types:', error);
    throw error;
  }
}
