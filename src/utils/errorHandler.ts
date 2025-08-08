// src/utils/errorHandler.ts

import {
  Client,
  Interaction,
  EmbedBuilder,
  DiscordAPIError,
  CommandInteraction,
} from "discord.js";
import logger from "./logger";
import {
  CooldownError,
  BusinessError,
  CustomCheckError,
  MissingPermissionsError,
} from "../errors";
import {
  createMissingPermissionsReply,
  createUnauthorizedReply,
  createBusinessErrorReply,
  createCheckFailureReply,
  createCooldownReply,
  createInternalErrorReply,
  createAutoModBlockedReply,
  createDiscordErrorReply,
} from "../utils/interactionReply";

// Define Discord API error codes for readability
const DISCORD_API_ERROR_CODES = {
  MISSING_PERMISSIONS: 50013,
  USER_MISSING_PERMISSIONS: 50001, // Note: This is often the same as MISSING_ACCESS (50001)
  MISSING_ACCESS: 50001,
  AUTO_MODERATION_BLOCKED: 200000, // Example, actual code may vary
  UNKNOWN_INTERACTION: 10062,
};

/**
 * Safely sends an error message to a Discord interaction.
 * Handles cases where the interaction has already been replied to or deferred.
 * @param interaction - The Discord interaction object.
 * @param message - The error message to display.
 * @param ephemeral - Whether the error message should be ephemeral.
 */
export async function sendErrorResponse(
  interaction: Interaction,
  payload: any,
  ephemeral: boolean = true
): Promise<void> {
  try {
    if (interaction.isRepliable()) {
      const options = { ...payload, ephemeral };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(options);
      } else {
        await interaction.reply(options);
      }
    }
  } catch (e: any) {
    // If sending the error fails (e.g., interaction expired), log it.
    if (e.code === DISCORD_API_ERROR_CODES.UNKNOWN_INTERACTION) {
      const errorMessage =
        payload.embeds?.[0]?.description || "An unknown error occurred.";
      logger.warn(
        `[ErrorHandler] Failed to send error response: Interaction expired or was deleted. Original error: ${errorMessage}`
      );
    } else {
      logger.error(
        `[ErrorHandler] Failed to send error response: ${e.message}`,
        e
      );
    }
  }
}

// --- Helper Functions for Specific Error Types ---

async function handleCheckFailure(
  interaction: Interaction,
  error: CustomCheckError,
  userInfo: string
): Promise<void> {
  const commandName = interaction.isCommand() ? interaction.commandName : "N/A";
  logger.warn(
    `[ErrorHandler] Command check failed: command '${commandName}' by user ${userInfo}. Error: ${error.message}`
  );
  await sendErrorResponse(
    interaction,
    createCheckFailureReply(interaction, error.message)
  );
}

async function handleMissingPermissions(
  interaction: Interaction,
  error: MissingPermissionsError,
  userInfo: string
): Promise<void> {
  const commandName = interaction.isCommand() ? interaction.commandName : "N/A";
  logger.warn(
    `[ErrorHandler] Permission check failed: command '${commandName}' by user ${userInfo}. Error: ${error.message}`
  );
  await sendErrorResponse(
    interaction,
    createMissingPermissionsReply(interaction)
  );
}

async function handleCooldown(
  interaction: Interaction,
  error: CooldownError,
  userInfo: string,
  commandName: string
): Promise<void> {
  const remaining = error.retryAfter;
  logger.warn(
    `[ErrorHandler] Command on cooldown: user ${userInfo}, command '${commandName}', retryAfter: ${remaining.toFixed(
      2
    )}s`
  );
  await sendErrorResponse(
    interaction,
    createCooldownReply(interaction, remaining)
  );
}

async function handleDiscordHttpException(
  interaction: Interaction,
  error: DiscordAPIError,
  userInfo: string,
  commandName: string
): Promise<void> {
  const logMsg = `[ErrorHandler] Discord HTTP Error (Status: ${error.status}, Code: ${error.code}): source '${commandName}' by user ${userInfo}. Error: ${error.message}`;

  if (error.status === 429) {
    logger.error(`${logMsg} - Rate Limited`);
    return; // Discord.js handles this, so we usually just log it.
  }

  if (
    [401, 403].includes(error.status) ||
    [
      DISCORD_API_ERROR_CODES.MISSING_PERMISSIONS,
      DISCORD_API_ERROR_CODES.MISSING_ACCESS,
    ].includes(error.code as number)
  ) {
    logger.error(`${logMsg} - Permissions Denied`);
    await sendErrorResponse(
      interaction,
      createMissingPermissionsReply(interaction)
    );
  } else if (
    error.message.toLowerCase().includes("automod") ||
    error.code === DISCORD_API_ERROR_CODES.AUTO_MODERATION_BLOCKED
  ) {
    logger.warn(`${logMsg} - AutoMod Blocked`);
    await sendErrorResponse(
      interaction,
      createAutoModBlockedReply(interaction)
    );
  } else {
    logger.warn(`${logMsg} - Other HTTP Error`);
    await sendErrorResponse(interaction, createDiscordErrorReply(interaction));
  }
}

async function recordFailedCommand(
  client: Client,
  interaction: Interaction,
  commandName: string,
  error: Error
): Promise<void> {
  logger.debug(
    `[ErrorHandler] Statistics: Failed command recorded: ${commandName} by ${interaction.user.tag}. Reason: ${error.message}`
  );
}

// --- Main Exported Functions ---

export async function handleInteractionError(
  interaction: Interaction,
  error: any,
  client: Client
): Promise<void> {
  const userInfo = `'${interaction.user.tag}' (ID: ${interaction.user.id})`;
  const commandName = interaction.isCommand()
    ? (interaction as CommandInteraction).commandName
    : interaction.isMessageComponent() || interaction.isModalSubmit()
    ? `Component:${interaction.customId}`
    : "Unknown Interaction";

  const originalError = error.original || error;

  // --- Error Classification and Handling ---

  if (originalError instanceof CustomCheckError) {
    await handleCheckFailure(interaction, originalError, userInfo);
  } else if (originalError instanceof MissingPermissionsError) {
    await handleMissingPermissions(interaction, originalError, userInfo);
  } else if (originalError instanceof CooldownError) {
    await handleCooldown(interaction, originalError, userInfo, commandName);
  } else if (originalError instanceof BusinessError) {
    logger.error(
      `[ErrorHandler] Business logic error: command '${commandName}' by user ${userInfo}. Error: ${originalError.message}`
    );
    await sendErrorResponse(
      interaction,
      createBusinessErrorReply(interaction, originalError.message)
    );
  } else if (originalError instanceof DiscordAPIError) {
    await handleDiscordHttpException(
      interaction,
      originalError,
      userInfo,
      commandName
    );
  } else {
    // --- Fallback for Unhandled Errors (Bugs) ---
    logger.error(
      `[ErrorHandler] Unhandled interaction error (BUG): command '${commandName}' by user ${userInfo}.`,
      originalError // Pass the full error object for stack tracing
    );
    await sendErrorResponse(interaction, createInternalErrorReply(interaction));
    await recordFailedCommand(client, interaction, commandName, originalError);
  }
}

export function handleClientError(client: Client, error: Error): void {
  logger.error(`[ErrorHandler] Discord Client Error: ${error.message}`, error);
}

export function handleClientWarning(client: Client, warning: string): void {
  logger.warn(`[ErrorHandler] Discord Client Warning: ${warning}`);
}

export async function recordSuccessfulCommand(
  client: Client,
  interaction: Interaction,
  commandName: string
): Promise<void> {
  logger.debug(
    `[ErrorHandler] Statistics: Successful command recorded: ${commandName} by ${interaction.user.tag}`
  );
}

// Export all functions in a single object for easy importing
export const errorHandler = {
  sendErrorResponse,
  handleInteractionError,
  handleClientError,
  handleClientWarning,
  recordSuccessfulCommand,
};
