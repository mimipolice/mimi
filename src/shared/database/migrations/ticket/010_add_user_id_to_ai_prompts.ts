import { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("ai_prompts")
    .addColumn("user_id", "varchar(255)")
    .execute();

  // Data migration here if needed, for now we just remove the column
  await db.schema.alterTable("ai_prompts").dropColumn("guild_id").execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("ai_prompts")
    .addColumn("guild_id", "varchar(255)")
    .execute();
  await db.schema.alterTable("ai_prompts").dropColumn("user_id").execute();
}
