import { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('guild_settings')
    .addColumn('panelAuthorIconUrl', 'text')
    .addColumn('panelThumbnailUrl', 'text')
    .addColumn('panelFooterIconUrl', 'text')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('guild_settings')
    .dropColumn('panelAuthorIconUrl')
    .dropColumn('panelThumbnailUrl')
    .dropColumn('panelFooterIconUrl')
    .execute();
}
