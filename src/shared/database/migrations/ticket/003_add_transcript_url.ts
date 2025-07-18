import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS "transcriptUrl" VARCHAR(2048) NULL;
  `.execute(db);
}
