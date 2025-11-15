import { mimiDLCDb } from "../shared/database";
import logger from "../utils/logger";
import { isValidEmoji } from "../utils/emojiValidator";

/**
 * Script to clean invalid emojis from autoreacts table
 */
async function cleanInvalidEmojis() {
  try {
    logger.info("Starting invalid emoji cleanup...");

    // Get all autoreacts
    const autoreacts = await mimiDLCDb
      .selectFrom("auto_reacts")
      .selectAll()
      .execute();

    logger.info(`Found ${autoreacts.length} autoreact entries`);

    let invalidCount = 0;
    const invalidEntries: Array<{
      guild_id: string;
      channel_id: string;
      emoji: string;
    }> = [];

    for (const autoreact of autoreacts) {
      if (!isValidEmoji(autoreact.emoji)) {
        invalidCount++;
        invalidEntries.push({
          guild_id: autoreact.guild_id,
          channel_id: autoreact.channel_id,
          emoji: autoreact.emoji,
        });
        logger.warn(
          `Invalid emoji found: "${autoreact.emoji}" in guild ${autoreact.guild_id}, channel ${autoreact.channel_id}`
        );
      }
    }

    if (invalidCount === 0) {
      logger.info("✅ No invalid emojis found!");
      return;
    }

    logger.info(`Found ${invalidCount} invalid emoji(s)`);
    logger.info("Invalid entries:", invalidEntries);

    // Delete invalid entries
    for (const entry of invalidEntries) {
      await mimiDLCDb
        .deleteFrom("auto_reacts")
        .where("guild_id", "=", entry.guild_id)
        .where("channel_id", "=", entry.channel_id)
        .execute();
      logger.info(`Deleted invalid autoreact for channel ${entry.channel_id}`);
    }
    logger.info(`✅ Cleaned up ${invalidCount} invalid emoji(s)`);
  } catch (error) {
    logger.error("Error cleaning invalid emojis:", error);
  } finally {
    await mimiDLCDb.destroy();
    process.exit(0);
  }
}

cleanInvalidEmojis();
