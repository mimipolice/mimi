import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    ALTER TABLE guild_settings
    ADD COLUMN IF NOT EXISTS "panelTitle" TEXT NULL,
    ADD COLUMN IF NOT EXISTS "panelDescription" TEXT NULL;
  `.execute(db);
}
