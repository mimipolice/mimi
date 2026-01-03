/**
 * Transcript Migration Script: Local -> Cloudflare R2
 *
 * This script migrates all local transcript files to Cloudflare R2 and updates
 * the database with new URLs.
 *
 * Usage:
 *   npx ts-node src/scripts/migrate-transcripts-to-r2.ts [--dry-run] [--delete-after] [--concurrency=N]
 *
 * Options:
 *   --dry-run         Preview changes without uploading or modifying database
 *   --delete-after    Delete local files after successful upload and DB update
 *   --concurrency=N   Maximum concurrent uploads (default: 5, max: 20)
 *
 * Required Environment Variables:
 *   - TRANSCRIPT_PATH: Local directory containing transcript files
 *   - R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL
 *   - DATABASE_URL: PostgreSQL connection string for mimiDLC database
 */

import fs from "fs";
import path from "path";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import pLimit from "p-limit";
import { uploadToR2, isR2Configured } from "../utils/r2";
import { MimiDLCDB } from "../shared/database/types";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

interface MigrationResult {
  fileName: string;
  channelId: string;
  oldUrl: string | null;
  newUrl: string;
  status: "success" | "failed" | "skipped";
  error?: string;
}

interface MigrationStats {
  total: number;
  uploaded: number;
  dbUpdated: number;
  deleted: number;
  failed: number;
  skipped: number;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const deleteAfter = args.includes("--delete-after");

  // Parse concurrency option (default: 5, max: 20)
  const concurrencyArg = args.find((a) => a.startsWith("--concurrency="));
  let concurrency = 5;
  if (concurrencyArg) {
    const parsed = parseInt(concurrencyArg.split("=")[1], 10);
    if (!isNaN(parsed) && parsed > 0) {
      concurrency = Math.min(parsed, 20);
    }
  }

  console.log("=".repeat(60));
  console.log("Transcript Migration: Local -> Cloudflare R2");
  console.log("=".repeat(60));
  console.log(`Mode: ${dryRun ? "DRY RUN (no changes will be made)" : "LIVE"}`);
  console.log(`Delete after upload: ${deleteAfter ? "YES" : "NO"}`);
  console.log(`Concurrency: ${concurrency} parallel uploads`);
  console.log("");

  // Validate environment
  const transcriptPathEnv = process.env.TRANSCRIPT_PATH;
  if (!transcriptPathEnv) {
    console.error("ERROR: TRANSCRIPT_PATH environment variable is not set");
    process.exit(1);
  }

  if (!fs.existsSync(transcriptPathEnv)) {
    console.error(`ERROR: TRANSCRIPT_PATH does not exist: ${transcriptPathEnv}`);
    process.exit(1);
  }

  // Store validated path (TypeScript needs this for nested function type narrowing)
  const transcriptPath: string = transcriptPathEnv;

  if (!isR2Configured()) {
    console.error("ERROR: R2 is not properly configured. Check environment variables:");
    console.error("  - R2_ACCOUNT_ID");
    console.error("  - R2_ACCESS_KEY_ID");
    console.error("  - R2_SECRET_ACCESS_KEY");
    console.error("  - R2_BUCKET_NAME");
    console.error("  - R2_PUBLIC_URL");
    process.exit(1);
  }

  // Connect to database
  const databaseUrl = process.env.MIMIDLC_DATABASE_URL || process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("ERROR: DATABASE_URL or MIMIDLC_DATABASE_URL environment variable is not set");
    process.exit(1);
  }

  const db = new Kysely<MimiDLCDB>({
    dialect: new PostgresDialect({
      pool: new Pool({ connectionString: databaseUrl }),
    }),
  });

  console.log(`Transcript directory: ${transcriptPath}`);
  console.log("");

  // Find all transcript files
  const files = fs.readdirSync(transcriptPath).filter((f) => f.endsWith(".html"));
  console.log(`Found ${files.length} transcript files`);

  if (files.length === 0) {
    console.log("No files to migrate. Exiting.");
    await db.destroy();
    return;
  }

  const stats: MigrationStats = {
    total: files.length,
    uploaded: 0,
    dbUpdated: 0,
    deleted: 0,
    failed: 0,
    skipped: 0,
  };

  const results: MigrationResult[] = [];

  // Create concurrency limiter to avoid R2 API rate limiting
  const limit = pLimit(concurrency);
  let completed = 0;

  // Process file function for concurrent execution
  async function processFile(fileName: string): Promise<MigrationResult> {
    completed++;
    console.log(`\n[${completed}/${files.length}] Processing: ${fileName}`);

    // Extract channelId from filename: transcript-{channelId}-{timestamp}.html
    const match = fileName.match(/^transcript-(\d+)-\d+\.html$/);
    if (!match) {
      console.log(`  Skipping: Invalid filename format`);
      return {
        fileName,
        channelId: "",
        oldUrl: null,
        newUrl: "",
        status: "skipped",
        error: "Invalid filename format",
      };
    }

    const channelId = match[1];
    const filePath = path.join(transcriptPath, fileName);

    try {
      // Read file content
      const fileContent = fs.readFileSync(filePath);
      console.log(`  File size: ${(fileContent.length / 1024).toFixed(2)} KB`);

      // Find ticket in database
      const ticket = await db
        .selectFrom("tickets")
        .select(["id", "transcriptUrl"])
        .where("channelId", "=", channelId)
        .executeTakeFirst();

      if (!ticket) {
        console.log(`  Warning: No ticket found for channelId ${channelId}`);
      }

      const oldUrl = ticket?.transcriptUrl || null;

      if (dryRun) {
        // Dry run - just simulate
        const simulatedUrl = `${process.env.R2_PUBLIC_URL}/transcripts/${fileName}`;
        console.log(`  [DRY RUN] Would upload to: ${simulatedUrl}`);
        if (ticket) {
          console.log(`  [DRY RUN] Would update ticket ID ${ticket.id}`);
          console.log(`  [DRY RUN] Old URL: ${oldUrl || "(none)"}`);
        }
        if (deleteAfter) {
          console.log(`  [DRY RUN] Would delete local file`);
        }

        return {
          fileName,
          channelId,
          oldUrl,
          newUrl: simulatedUrl,
          status: "success",
        };
      } else {
        // Live run - actually upload
        const uploadResult = await uploadToR2({
          key: fileName,
          body: fileContent,
          contentType: "text/html; charset=utf-8",
          prefix: "transcripts",
          cacheControl: "public, max-age=31536000",
        });

        if (!uploadResult.success || !uploadResult.url) {
          throw new Error(uploadResult.error || "Upload failed");
        }

        console.log(`  Uploaded to: ${uploadResult.url}`);

        // Update database if ticket exists
        if (ticket) {
          await db
            .updateTable("tickets")
            .set({ transcriptUrl: uploadResult.url })
            .where("id", "=", ticket.id)
            .execute();

          console.log(`  Updated ticket ID ${ticket.id}`);
        }

        // Delete local file if requested
        if (deleteAfter) {
          fs.unlinkSync(filePath);
          console.log(`  Deleted local file`);
        }

        return {
          fileName,
          channelId,
          oldUrl,
          newUrl: uploadResult.url,
          status: "success",
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`  ERROR: ${errorMessage}`);

      return {
        fileName,
        channelId,
        oldUrl: null,
        newUrl: "",
        status: "failed",
        error: errorMessage,
      };
    }
  }

  // Process all files with concurrency control
  const fileResults = await Promise.all(
    files.map((fileName) => limit(() => processFile(fileName)))
  );

  // Aggregate results and stats
  for (const result of fileResults) {
    results.push(result);
    if (result.status === "success") {
      stats.uploaded++;
      if (result.oldUrl !== null || result.newUrl) {
        // Check if we had a ticket to update
        const hadTicket = result.channelId !== "";
        if (hadTicket) stats.dbUpdated++;
      }
      if (deleteAfter && !dryRun) stats.deleted++;
    } else if (result.status === "failed") {
      stats.failed++;
    } else {
      stats.skipped++;
    }
  }

  // Print summary
  console.log("\n" + "=".repeat(60));
  console.log("Migration Summary");
  console.log("=".repeat(60));
  console.log(`Total files:     ${stats.total}`);
  console.log(`Uploaded:        ${stats.uploaded}`);
  console.log(`DB updated:      ${stats.dbUpdated}`);
  console.log(`Deleted:         ${stats.deleted}`);
  console.log(`Failed:          ${stats.failed}`);
  console.log(`Skipped:         ${stats.skipped}`);

  if (stats.failed > 0) {
    console.log("\nFailed files:");
    results
      .filter((r) => r.status === "failed")
      .forEach((r) => {
        console.log(`  - ${r.fileName}: ${r.error}`);
      });
  }

  if (dryRun) {
    console.log("\n[DRY RUN] No changes were made. Run without --dry-run to perform migration.");
  }

  await db.destroy();
  console.log("\nDone.");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
