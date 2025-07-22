import { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("ai_conversations")
    .addColumn("channel_id", "varchar(255)")
    .addColumn("message_id", "varchar(255)")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("ai_conversations")
    .dropColumn("channel_id")
    .dropColumn("message_id")
    .execute();
}
