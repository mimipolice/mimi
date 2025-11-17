import { mimiDLCDb } from "../shared/database";
import { getAntiSpamSettings } from "../repositories/admin.repository";
import { CacheService } from "../services/CacheService";
import config from "../config";
import logger from "../utils/logger";

const GUILD_ID = "1256599582801137764";

async function diagnoseAntiSpam() {
  console.log("=== Anti-Spam Diagnostic Tool ===\n");

  // 1. Check database settings
  console.log("1. Checking database settings...");
  try {
    const dbSettings = await getAntiSpamSettings(GUILD_ID);
    if (dbSettings) {
      console.log("✓ Database settings found:");
      console.log(JSON.stringify(dbSettings, null, 2));
    } else {
      console.log("✗ No database settings found for this guild");
      console.log("  Using default config values:");
      console.log(`  - spamThreshold: ${config.antiSpam.spamThreshold}`);
      console.log(`  - timeWindow: ${config.antiSpam.timeWindow}ms`);
      console.log(`  - multiChannelSpamThreshold: ${config.antiSpam.multiChannelSpamThreshold}`);
      console.log(`  - multiChannelTimeWindow: ${config.antiSpam.multiChannelTimeWindow}ms`);
    }
  } catch (error) {
    console.error("✗ Error fetching database settings:", error);
  }

  // 2. Check cache
  console.log("\n2. Checking cache...");
  try {
    const cacheService = new CacheService();
    const cacheKey = `antiSpamSettings:${GUILD_ID}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      console.log("✓ Cache found:");
      console.log(JSON.stringify(cached, null, 2));
    } else {
      console.log("✗ No cache found (will fetch from DB on first message)");
    }
  } catch (error) {
    console.error("✗ Error checking cache:", error);
  }

  // 3. Check anti_spam_settings table structure
  console.log("\n3. Checking anti_spam_settings table structure...");
  try {
    const result = await mimiDLCDb
      .selectFrom("anti_spam_settings")
      .selectAll()
      .where("guildid", "=", GUILD_ID)
      .executeTakeFirst();
    
    if (result) {
      console.log("✓ Table record exists:");
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log("✗ No record in anti_spam_settings table");
    }
  } catch (error) {
    console.error("✗ Error querying table:", error);
  }

  // 4. Check anti_spam_logs table
  console.log("\n4. Checking anti_spam_logs table...");
  try {
    const logChannel = await mimiDLCDb
      .selectFrom("anti_spam_logs")
      .select("log_channel_id")
      .where("guild_id", "=", GUILD_ID)
      .executeTakeFirst();
    
    if (logChannel) {
      console.log(`✓ Log channel configured: ${logChannel.log_channel_id}`);
    } else {
      console.log("✗ No log channel configured");
    }
  } catch (error) {
    console.error("✗ Error checking log channel:", error);
  }

  // 5. Check Redis connection
  console.log("\n5. Checking Redis connection...");
  try {
    const cacheService = new CacheService();
    await cacheService.set("test:ping", "pong", 5);
    const pong = await cacheService.get("test:ping");
    if (pong === "pong") {
      console.log("✓ Redis connection working");
    } else {
      console.log("✗ Redis connection issue");
    }
    await cacheService.del("test:ping");
  } catch (error) {
    console.error("✗ Redis error:", error);
  }

  // 6. Check config values
  console.log("\n6. Default config values:");
  console.log(`  - spamThreshold: ${config.antiSpam.spamThreshold} messages`);
  console.log(`  - timeWindow: ${config.antiSpam.timeWindow}ms (${config.antiSpam.timeWindow / 1000}s)`);
  console.log(`  - multiChannelSpamThreshold: ${config.antiSpam.multiChannelSpamThreshold} channels`);
  console.log(`  - multiChannelTimeWindow: ${config.antiSpam.multiChannelTimeWindow}ms (${config.antiSpam.multiChannelTimeWindow / 1000}s)`);
  console.log(`  - timeoutDuration: ${config.antiSpam.timeoutDuration}ms (${config.antiSpam.timeoutDuration / 1000 / 60 / 60}h)`);
  console.log(`  - ignoredRoles: ${config.antiSpam.ignoredRoles.join(", ") || "none"}`);
  console.log(`  - ignoredUsers: ${config.antiSpam.ignoredUsers.join(", ") || "none"}`);

  console.log("\n=== Diagnostic Complete ===");
  process.exit(0);
}

diagnoseAntiSpam().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
