import { Kysely } from "kysely";

/**
 * Migration: Add openReason field
 *
 * Adds openReason column to store the issue description when a ticket is created.
 * This allows displaying the original reason in ticket logs.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("tickets")
    .addColumn("openReason", "text")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("tickets").dropColumn("openReason").execute();
}
