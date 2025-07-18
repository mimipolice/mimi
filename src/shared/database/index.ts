import { Pool } from "pg";
import path from "path";
import logger from "../../utils/logger";
import { Kysely, PostgresDialect } from "kysely";
import { DB } from "./types";
import { promises as fs } from "fs";

// Gacha Database Pool
export const gachaPool = new Pool({
  host: process.env.DB_GACHA_HOST,
  database: process.env.DB_GACHA_NAME,
  user: process.env.DB_GACHA_USER,
  password: process.env.DB_GACHA_PASSWORD,
  port: Number(process.env.DB_GACHA_PORT),
});

// Ticket Database Pool
export const ticketPool = new Pool({
  host: process.env.DB_TICKET_HOST,
  database: process.env.DB_TICKET_NAME,
  user: process.env.DB_TICKET_USER,
  password: process.env.DB_TICKET_PASSWORD,
  port: Number(process.env.DB_TICKET_PORT),
});

// Kysely instances for query building
export const gachaDB = new Kysely<DB>({
  dialect: new PostgresDialect({ pool: gachaPool }),
});

export const ticketDB = new Kysely<DB>({
  dialect: new PostgresDialect({ pool: ticketPool }),
});

// A more robust, manual migration runner
export const migrateToLatest = async (
  db: Kysely<any>,
  dbName: string,
  migrationPath: string
) => {
  logger.info(`[${dbName}] Running migrations from: ${migrationPath}`);

  // 1. Ensure the migrations table exists.
  await db.schema
    .createTable("schema_migrations")
    .ifNotExists()
    .addColumn("version", "varchar(255)", (col) => col.primaryKey())
    .execute();

  // 2. Get all migration files from the folder.
  const files = await fs.readdir(migrationPath);
  const migrationFiles = files.filter((file) => file.endsWith(".js")).sort();

  if (migrationFiles.length === 0) {
    logger.info(`[${dbName}] No migration files found.`);
    return;
  }

  logger.info(`[${dbName}] Found migration files:`, migrationFiles);

  // 3. Get all already applied migrations from the database.
  const appliedMigrations = await db
    .selectFrom("schema_migrations")
    .select("version")
    .execute();
  const appliedVersions = new Set(appliedMigrations.map((row) => row.version));

  // 4. Run all pending migrations.
  for (const migrationFile of migrationFiles) {
    if (appliedVersions.has(migrationFile)) {
      logger.info(
        `[${dbName}] Skipping already applied migration: ${migrationFile}`
      );
      continue;
    }

    logger.info(`[${dbName}] Applying migration: ${migrationFile}`);
    const migration = await import(path.join(migrationPath, migrationFile));

    // Handle CJS/ESM module differences
    const migrationModule = migration.default || migration;

    if (typeof migrationModule.up !== "function") {
      logger.warn(
        `[${dbName}] Migration ${migrationFile} has no 'up' function. Skipping.`
      );
      continue;
    }

    try {
      // Run the migration within a transaction
      await db.transaction().execute(async (trx) => {
        await migrationModule.up(trx);
        await trx
          .insertInto("schema_migrations")
          .values({ version: migrationFile })
          .execute();
      });
      logger.info(
        `[${dbName}] Migration "${migrationFile}" was executed successfully`
      );
    } catch (error) {
      logger.error(
        `[${dbName}] Failed to execute migration "${migrationFile}"`,
        error
      );
      throw error;
    }
  }

  logger.info(`[${dbName}] Migrations completed successfully.`);
};
