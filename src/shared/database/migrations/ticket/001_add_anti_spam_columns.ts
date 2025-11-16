import { Kysely, sql } from "kysely";

/**
 * Migration: Add missing columns to anti_spam_settings table
 * Date: 2025-01-16
 * 
 * Adds the following columns:
 * - time_window: Time window in milliseconds for spam detection
 * - multichannelthreshold: Threshold for multi-channel spam detection
 * - multichanneltimewindow: Time window for multi-channel spam detection
 * - ignored_roles: JSON array of role IDs to ignore
 */
export async function up(db: Kysely<any>): Promise<void> {
  // Add time_window column with default value of 5000ms (5 seconds)
  await sql`
    ALTER TABLE anti_spam_settings 
    ADD COLUMN IF NOT EXISTS time_window INTEGER NOT NULL DEFAULT 5000
  `.execute(db);

  // Add optional multi-channel spam detection columns
  await sql`
    ALTER TABLE anti_spam_settings 
    ADD COLUMN IF NOT EXISTS multichannelthreshold INTEGER
  `.execute(db);

  await sql`
    ALTER TABLE anti_spam_settings 
    ADD COLUMN IF NOT EXISTS multichanneltimewindow INTEGER
  `.execute(db);

  // Add ignored_roles as TEXT column to store JSON array
  await sql`
    ALTER TABLE anti_spam_settings 
    ADD COLUMN IF NOT EXISTS ignored_roles TEXT
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  // Remove the added columns
  await sql`
    ALTER TABLE anti_spam_settings 
    DROP COLUMN IF EXISTS time_window,
    DROP COLUMN IF EXISTS multichannelthreshold,
    DROP COLUMN IF EXISTS multichanneltimewindow,
    DROP COLUMN IF EXISTS ignored_roles
  `.execute(db);
}
