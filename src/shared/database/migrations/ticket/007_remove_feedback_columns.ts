import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    ALTER TABLE tickets
    DROP COLUMN IF EXISTS "feedbackRating",
    DROP COLUMN IF EXISTS "feedbackComment";
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('tickets')
    .addColumn('feedbackRating', 'integer')
    .addColumn('feedbackComment', 'text')
    .execute();
}
