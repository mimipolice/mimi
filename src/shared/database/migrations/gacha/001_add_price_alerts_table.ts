import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS price_alerts (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      asset_symbol VARCHAR(10) NOT NULL,
      condition VARCHAR(10) NOT NULL, -- 'above' or 'below'
      target_price NUMERIC(18, 8) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      last_notified_at TIMESTAMP WITH TIME ZONE
    );
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP TABLE IF EXISTS price_alerts;`.execute(db);
}
