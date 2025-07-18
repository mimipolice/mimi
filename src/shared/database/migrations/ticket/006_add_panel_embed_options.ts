import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    ALTER TABLE guild_settings
    ADD COLUMN IF NOT EXISTS "panelAuthorIconUrl" TEXT NULL,
    ADD COLUMN IF NOT EXISTS "panelThumbnailUrl" TEXT NULL,
    ADD COLUMN IF NOT EXISTS "panelFooterIconUrl" TEXT NULL;
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("guild_settings")
    .dropColumn("panelAuthorIconUrl")
    .dropColumn("panelThumbnailUrl")
    .dropColumn("panelFooterIconUrl")
    .execute();
}
