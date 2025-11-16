# Database Migrations

This directory contains database migration files for the project.

## Directory Structure

- `ticket/` - Migrations for the MimiDLC database (tickets, anti-spam, settings, etc.)
- `gacha/` - Migrations for the Gacha database (future use)

## Migration File Naming Convention

Migration files should follow this pattern:
```
NNN_descriptive_name.ts
```

Where:
- `NNN` is a zero-padded sequence number (001, 002, 003, etc.)
- `descriptive_name` briefly describes what the migration does

Example: `001_add_anti_spam_columns.ts`

## Creating a New Migration

1. Create a new file in the appropriate subdirectory (`ticket/` or `gacha/`)
2. Use the next sequential number
3. Export `up` and `down` functions:

```typescript
import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // Your migration code here
  await sql`
    ALTER TABLE your_table 
    ADD COLUMN new_column TYPE
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  // Rollback code here
  await sql`
    ALTER TABLE your_table 
    DROP COLUMN new_column
  `.execute(db);
}
```

## Running Migrations

Currently, migrations are commented out in `src/index.ts`. To enable them:

1. Uncomment the migration code in `src/index.ts`:
```typescript
await migrateToLatest(
  mimiDLCDb,
  "ticket",
  path.join(__dirname, "shared/database/migrations/ticket")
);
```

2. Restart the application - migrations will run automatically on startup

## Manual Migration

If you need to run a migration manually, you can use the MCP Postgres server tools or connect directly to the database and run the SQL.

## Important Notes

- Migrations run in alphabetical order by filename
- Each migration is tracked in the `schema_migrations` table
- Migrations are run in a transaction - if one fails, it will roll back
- Always test migrations in a development environment first
- Keep migrations small and focused on one change
