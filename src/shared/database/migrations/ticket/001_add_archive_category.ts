import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // Use raw SQL with `IF NOT EXISTS` for idempotent migrations.
  await sql`
    ALTER TABLE guild_settings
    ADD COLUMN IF NOT EXISTS "archiveCategoryId" VARCHAR(255) NULL;
  `.execute(db);
}
