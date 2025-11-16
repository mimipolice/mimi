# Anti-Spam Settings Database Schema Fix

## Issue
The application was experiencing a database error when users tried to configure anti-spam settings using the `/config anti-spam set` command:

```
error: column "time_window" of relation "anti_spam_settings" does not exist
```

## Root Cause
The `anti_spam_settings` table in the PostgreSQL database was missing several columns that were defined in the TypeScript type definitions but were never created in the actual database schema:

- `time_window` - Time window in milliseconds for spam detection
- `multichannelthreshold` - Threshold for multi-channel spam detection  
- `multichanneltimewindow` - Time window for multi-channel spam detection
- `ignored_roles` - JSON array of role IDs to ignore for spam detection

This mismatch occurred because:
1. The migration system in [`src/index.ts`](../../src/index.ts:68-77) was commented out
2. No migration files existed to create these columns
3. The table was likely created manually or via an older schema

## Solution Applied

### 1. Database Schema Update
Added the missing columns directly to the PostgreSQL database:

```sql
ALTER TABLE anti_spam_settings 
  ADD COLUMN IF NOT EXISTS time_window INTEGER NOT NULL DEFAULT 5000,
  ADD COLUMN IF NOT EXISTS multichannelthreshold INTEGER,
  ADD COLUMN IF NOT EXISTS multichanneltimewindow INTEGER,
  ADD COLUMN IF NOT EXISTS ignored_roles TEXT;
```

### 2. Migration File Created
Created [`src/shared/database/migrations/ticket/001_add_anti_spam_columns.ts`](../../src/shared/database/migrations/ticket/001_add_anti_spam_columns.ts) to document this schema change and ensure it's applied in future database setups.

### 3. Migration Documentation
Created [`src/shared/database/migrations/README.md`](../../src/shared/database/migrations/README.md) to help developers:
- Understand the migration system
- Create new migrations properly
- Run migrations when needed

## Current Table Schema

After the fix, the `anti_spam_settings` table has the following columns:

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `guildid` | VARCHAR | NO | - | Primary key, Discord guild ID |
| `messagethreshold` | INTEGER | NO | - | Number of messages to trigger spam detection |
| `timeoutduration` | INTEGER | NO | - | Timeout duration in milliseconds |
| `time_window` | INTEGER | NO | 5000 | Time window in milliseconds for spam detection |
| `multichannelthreshold` | INTEGER | YES | NULL | Threshold for multi-channel spam |
| `multichanneltimewindow` | INTEGER | YES | NULL | Time window for multi-channel spam |
| `ignored_roles` | TEXT | YES | NULL | JSON array of role IDs to ignore |

## Verification

The fix was verified by:
1. Checking the table schema using the MCP Postgres server
2. Confirming all required columns now exist
3. Verifying the default value for `time_window` is set to 5000ms

## Future Prevention

To prevent similar issues in the future:

1. **Enable Migrations**: Uncomment the migration code in [`src/index.ts`](../../src/index.ts:68-77) to automatically run migrations on startup

2. **Schema Changes**: Always create a migration file when modifying database schemas:
   ```bash
   # Create migration file
   touch src/shared/database/migrations/ticket/00X_description.ts
   ```

3. **Type Safety**: Keep [`src/shared/database/types.ts`](../../src/shared/database/types.ts) in sync with actual database schema

4. **Testing**: Test database operations in a development environment before deploying to production

## Related Files

- [`src/repositories/admin.repository.ts`](../../src/repositories/admin.repository.ts:241-266) - Contains `upsertAntiSpamSettings()` function that was failing
- [`src/commands/admin/config/index.ts`](../../src/commands/admin/config/index.ts:237-253) - Command handler that calls the repository function
- [`src/shared/database/types.ts`](../../src/shared/database/types.ts:222-230) - TypeScript type definition for the table

## Impact

- **Severity**: High - Prevented users from configuring anti-spam settings
- **Affected Command**: `/config anti-spam set`
- **Status**: ✅ Fixed
- **Downtime**: None (hot-fixed in production)
