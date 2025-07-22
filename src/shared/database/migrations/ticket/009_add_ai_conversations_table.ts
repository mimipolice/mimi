import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("ai_conversations")
    .ifNotExists()
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("user_id", "varchar(255)", (col) => col.notNull())
    .addColumn("channel_id", "varchar(255)", (col) => col.notNull())
    .addColumn("message_id", "varchar(255)", (col) => col.notNull().unique())
    .addColumn("history", "jsonb", (col) => col.notNull())
    .addColumn("created_at", "timestamp", (col) =>
      col.defaultTo(sql`now()`).notNull()
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("ai_conversations").ifExists().execute();
}
