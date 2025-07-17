import { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('guild_settings')
    .addColumn('archiveCategoryId', 'varchar(255)')
    .execute();
}
