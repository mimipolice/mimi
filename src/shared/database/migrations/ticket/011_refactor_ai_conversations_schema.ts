import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // Create the new table for individual messages
  await db.schema
    .createTable("ai_conversation_messages")
    .ifNotExists()
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("conversation_id", "integer", (col) =>
      col.references("ai_conversations.id").onDelete("cascade").notNull()
    )
    .addColumn("role", "varchar(10)", (col) => col.notNull()) // 'user' or 'assistant'
    .addColumn("content", "text", (col) => col.notNull())
    .addColumn("created_at", "timestamp", (col) =>
      col.defaultTo(sql`now()`).notNull()
    )
    .execute();

  // Create an index for faster lookups
  await db.schema
    .createIndex("ai_conversation_messages_conversation_id_index")
    .on("ai_conversation_messages")
    .column("conversation_id")
    .execute();

  // Modify the existing conversations table
  await db.schema
    .alterTable("ai_conversations")
    .dropColumn("history")
    .dropColumn("channel_id")
    .dropColumn("message_id")
    .addColumn("updated_at", "timestamp", (col) =>
      col.defaultTo(sql`now()`).notNull()
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // Revert changes to the conversations table
  await db.schema
    .alterTable("ai_conversations")
    .dropColumn("updated_at")
    .addColumn("history", "jsonb", (col) => col.notNull())
    .addColumn("channel_id", "varchar(255)", (col) => col.notNull())
    .addColumn("message_id", "varchar(255)", (col) => col.notNull().unique())
    .execute();

  // Drop the new messages table
  await db.schema.dropTable("ai_conversation_messages").ifExists().execute();
}
