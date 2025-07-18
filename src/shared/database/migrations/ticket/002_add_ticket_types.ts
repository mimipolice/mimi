import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // Create the ticket_types table if it doesn't exist.
  await sql`
    CREATE TABLE IF NOT EXISTS ticket_types (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(255) NOT NULL,
        type_id VARCHAR(255) NOT NULL,
        label VARCHAR(100) NOT NULL,
        style VARCHAR(20) NOT NULL DEFAULT 'Secondary',
        emoji VARCHAR(255) NULL,
        UNIQUE (guild_id, type_id),
        CONSTRAINT fk_guild
            FOREIGN KEY(guild_id)
            REFERENCES guild_settings("guildId")
            ON DELETE CASCADE
    );
  `.execute(db);

  // Add the ticketType column to the tickets table if it doesn't exist.
  await sql`
    ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS "ticketType" VARCHAR(255) NULL;
  `.execute(db);
}
