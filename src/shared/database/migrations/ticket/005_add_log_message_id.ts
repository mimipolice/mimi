import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS "logMessageId" VARCHAR(255) NULL;
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable("tickets").dropColumn("logMessageId").execute();
}
