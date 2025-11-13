import { TextChannel, PermissionOverwrites } from "discord.js";
import logger from "./logger";

/**
 * Debug utility to log channel permission state
 * Useful for diagnosing permission-related issues
 */
export function logChannelPermissions(
  channel: TextChannel,
  context: string
): void {
  try {
    const overwrites = channel.permissionOverwrites.cache;
    logger.info(`[${context}] Channel ${channel.id} permission overwrites:`);
    
    overwrites.forEach((overwrite) => {
      const target = overwrite.type === 0 ? "Role" : "User";
      logger.info(
        `  - ${target} ${overwrite.id}: Allow=${overwrite.allow.toArray().join(", ") || "none"}, Deny=${overwrite.deny.toArray().join(", ") || "none"}`
      );
    });

    if (overwrites.size === 0) {
      logger.warn(`  - No permission overwrites found (inheriting from category)`);
    }
  } catch (error) {
    logger.error(`Failed to log permissions for channel ${channel.id}:`, error);
  }
}

/**
 * Safely delete a permission overwrite with retry logic
 */
export async function safeDeletePermissionOverwrite(
  channel: TextChannel,
  targetId: string,
  targetName: string
): Promise<boolean> {
  const maxRetries = 3;
  const retryDelay = 1000; // 1 second

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Check if overwrite exists before attempting to delete
      const overwrite = channel.permissionOverwrites.cache.get(targetId);
      if (!overwrite) {
        logger.info(
          `Permission overwrite for ${targetName} (${targetId}) does not exist in channel ${channel.id}, skipping deletion`
        );
        return true;
      }

      await channel.permissionOverwrites.delete(targetId);
      logger.info(
        `Successfully deleted permission overwrite for ${targetName} (${targetId}) in channel ${channel.id}`
      );
      return true;
    } catch (error: any) {
      logger.warn(
        `Attempt ${attempt}/${maxRetries} failed to delete permission overwrite for ${targetName} (${targetId}) in channel ${channel.id}:`,
        error
      );

      if (attempt < maxRetries) {
        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      } else {
        logger.error(
          `Failed to delete permission overwrite for ${targetName} (${targetId}) after ${maxRetries} attempts`
        );
        return false;
      }
    }
  }

  return false;
}

/**
 * Safely edit a permission overwrite with retry logic
 */
export async function safeEditPermissionOverwrite(
  channel: TextChannel,
  targetId: string,
  targetName: string,
  permissions: { ViewChannel?: boolean; SendMessages?: boolean; ReadMessageHistory?: boolean }
): Promise<boolean> {
  const maxRetries = 3;
  const retryDelay = 1000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await channel.permissionOverwrites.edit(targetId, permissions);
      logger.info(
        `Successfully edited permission overwrite for ${targetName} (${targetId}) in channel ${channel.id}`
      );
      return true;
    } catch (error: any) {
      logger.warn(
        `Attempt ${attempt}/${maxRetries} failed to edit permission overwrite for ${targetName} (${targetId}) in channel ${channel.id}:`,
        error
      );

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      } else {
        logger.error(
          `Failed to edit permission overwrite for ${targetName} (${targetId}) after ${maxRetries} attempts`
        );
        return false;
      }
    }
  }

  return false;
}
