import { Pool } from 'pg';

export async function up(db: Pool): Promise<void> {
  await db.query(`
    ALTER TABLE tickets
    ADD COLUMN "logMessageId" VARCHAR(255) NULL
  `);
}

export async function down(db: Pool): Promise<void> {
  await db.query(`
    ALTER TABLE tickets
    DROP COLUMN "logMessageId"
  `);
}
