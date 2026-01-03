import { Kysely, sql } from "kysely";

/**
 * Migration: Add ticket management fields
 *
 * Adds category, rating, and resolution columns to the tickets table.
 * These fields are set via the log message select menu after a ticket is closed.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("tickets")
    .addColumn("category", "varchar(50)")
    .execute();

  await db.schema
    .alterTable("tickets")
    .addColumn("rating", "integer")
    .execute();

  await db.schema
    .alterTable("tickets")
    .addColumn("resolution", "varchar(50)")
    .execute();

  // Add check constraint for rating (1-5)
  await sql`ALTER TABLE tickets ADD CONSTRAINT tickets_rating_check CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5))`.execute(
    db
  );
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_rating_check`.execute(
    db
  );

  await db.schema.alterTable("tickets").dropColumn("resolution").execute();

  await db.schema.alterTable("tickets").dropColumn("rating").execute();

  await db.schema.alterTable("tickets").dropColumn("category").execute();
}
