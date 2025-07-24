import { Pool, types } from "pg";

// Force int8 to be parsed as string
types.setTypeParser(20, (val) => {
  return val;
});
import path from "path";
import logger from "../../utils/logger";
import { Kysely, PostgresDialect } from "kysely";
import { DB, MimiDLCDB } from "./types";
import { promises as fs } from "fs";
import config from "../../config";

// Gacha Database Pool
export const gachaPool = new Pool({
  host: config.gachaDatabase.host,
  database: config.gachaDatabase.name,
  user: config.gachaDatabase.user,
  password: config.gachaDatabase.password,
  port: config.gachaDatabase.port,
});

// Ticket Database Pool
export const ticketPool = new Pool({
  host: config.ticketDatabase.host,
  database: config.ticketDatabase.name,
  user: config.ticketDatabase.user,
  password: config.ticketDatabase.password,
  port: config.ticketDatabase.port,
});

// Odog Database Pool
export const odogPool = new Pool({
  host: config.odogDatabase.host,
  user: config.odogDatabase.user,
  password: config.odogDatabase.password,
  database: config.odogDatabase.name,
  port: config.odogDatabase.port,
});

// mimiDLC Database Pool
export const mimiDLCPool = new Pool({
  host: config.mimiDLCDatabase.host,
  database: config.mimiDLCDatabase.name,
  user: config.mimiDLCDatabase.user,
  password: config.mimiDLCDatabase.password,
  port: config.mimiDLCDatabase.port,
});

// Kysely instances for query building
export const gachaDB = new Kysely<DB>({
  dialect: new PostgresDialect({ pool: gachaPool }),
});

export const ticketDB = new Kysely<DB>({
  dialect: new PostgresDialect({ pool: ticketPool }),
});

export const mimiDLCDb = new Kysely<MimiDLCDB>({
  dialect: new PostgresDialect({ pool: mimiDLCPool }),
});

// A more robust, manual migration runner
export const migrateToLatest = async (
  db: Kysely<any>,
  dbName: string,
  migrationPath: string
) => {
  logger.info(`[${dbName}]: Running migrations from: ${migrationPath}`);

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
    logger.info(`[${dbName}]: No migration files found.`);
    return;
  }

  logger.info(`[${dbName}]: Found migration files:`, migrationFiles);

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
        `[${dbName}]: Skipping already applied migration: ${migrationFile}`
      );
      continue;
    }

    logger.info(`[${dbName}]: Applying migration: ${migrationFile}`);
    const migration = await import(path.join(migrationPath, migrationFile));

    // Handle CJS/ESM module differences
    const migrationModule = migration.default || migration;

    if (typeof migrationModule.up !== "function") {
      logger.warn(
        `[${dbName}]: Migration ${migrationFile} has no 'up' function. Skipping.`
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
        `[${dbName}]: Migration "${migrationFile}" was executed successfully`
      );
    } catch (error) {
      logger.error(
        `[${dbName}]: Failed to execute migration "${migrationFile}"`,
        error
      );
      throw error;
    }
  }

  logger.info(`[${dbName}]: Migrations completed successfully.`);
};
