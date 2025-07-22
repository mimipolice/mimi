// src/utils/errorHandler.ts

import {
  Client,
  Interaction,
  EmbedBuilder,
  DiscordAPIError,
  CommandInteraction,
} from "discord.js";
import logger from "./logger";
import { CooldownError, BusinessError, CustomCheckError } from "../errors";

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
  message: string,
  ephemeral: boolean = true
): Promise<void> {
  const errorEmbed = new EmbedBuilder()
    .setDescription(message)
    .setColor("Red")
    .setAuthor({
      name: "嗚哦！操作失敗。",
      iconURL:
        "https://cdn.discordapp.com/attachments/1336020673730187334/1395531660908433418/close.png?ex=687ebe23&is=687d6ca3&hm=63db855b6dd77045bf0d878dd3002231664eeb4a794ab92db31f0a123b70016e&",
    })
    .setThumbnail(
      "https://cdn.discordapp.com/attachments/1336020673730187334/1395531136079237141/1388098388058181723.webp?ex=687ac926&is=687977a6&hm=08cc0bb1571259448e29b8b1bf3c085ea9ae74ba448648ed305537fcd8bd6bbd&"
    );

  try {
    if (interaction.isRepliable()) {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ embeds: [errorEmbed], ephemeral });
      } else {
        await interaction.reply({ embeds: [errorEmbed], ephemeral });
      }
    }
  } catch (e: any) {
    // If sending the error fails (e.g., interaction expired), log it.
    if (e.code === DISCORD_API_ERROR_CODES.UNKNOWN_INTERACTION) {
      logger.warn(
        `[ErrorHandler] Failed to send error response: Interaction expired or was deleted. Original error: ${message}`
      );
    } else {
      logger.error(
        `[ErrorHandler] Failed to send error response: ${e.message}`,
        e
      );
    }
  }
}

/**
 * Handles command check failures (e.g., custom checks).
 * @param interaction - The Discord interaction object.
 * @param error - The captured error object.
 * @param userInfo - Formatted user information string.
 */
async function handleCheckFailure(
  interaction: Interaction,
  error: CustomCheckError,
  userInfo: string
): Promise<void> {
  const commandName = interaction.isCommand() ? interaction.commandName : "N/A";
  logger.warn(
    `[ErrorHandler] Command check failed: command '${commandName}' by user ${userInfo}. Error: ${error.message}`
  );
  await sendErrorResponse(interaction, `❌ ${error.message}`);
}

/**
 * Handles command cooldown errors.
 * @param interaction - The Discord interaction object.
 * @param error - The CooldownError object.
 * @param userInfo - Formatted user information string.
 * @param commandName - The name of the command.
 */
async function handleCooldown(
  interaction: Interaction,
  error: CooldownError,
  userInfo: string,
  commandName: string
): Promise<void> {
  const remaining = error.retryAfter;
  const msg = `⏰ 指令冷卻中，請等待 ${Math.ceil(remaining)} 秒後再使用。`;
  logger.warn(
    `[ErrorHandler] Command on cooldown: user ${userInfo}, command '${commandName}', retryAfter: ${remaining.toFixed(
      2
    )}s`
  );
  await sendErrorResponse(interaction, msg);
}

/**
 * Handles Discord API HTTP request errors.
 * @param interaction - The Discord interaction object.
 * @param error - The DiscordAPIError instance.
 * @param userInfo - Formatted user information string.
 * @param commandName - The name of the command.
 */
async function handleDiscordHttpException(
  interaction: Interaction,
  error: DiscordAPIError,
  userInfo: string,
  commandName: string
): Promise<void> {
  const logMsg = `[ErrorHandler] Discord HTTP Error (Status: ${error.status}, Code: ${error.code}): source '${commandName}' by user ${userInfo}. Error: ${error.message}`;

  if (error.status === 429) {
    logger.error(`${logMsg} - Rate Limited`);
    // Discord.js handles this, so we usually just log it.
    return;
  }

  let userFacingMessage: string;
  if (
    [401, 403].includes(error.status) ||
    [
      DISCORD_API_ERROR_CODES.MISSING_PERMISSIONS,
      DISCORD_API_ERROR_CODES.MISSING_ACCESS,
    ].includes(error.code as number)
  ) {
    logger.error(`${logMsg} - Permissions Denied`);
    userFacingMessage = "❌ 權限不足，機器人或您自己缺少執行此操作的權限。";
  } else if (
    error.message.toLowerCase().includes("automod") ||
    error.code === DISCORD_API_ERROR_CODES.AUTO_MODERATION_BLOCKED
  ) {
    logger.warn(`${logMsg} - AutoMod Blocked`);
    userFacingMessage =
      "❌ 您的請求內容被 Discord AutoMod 攔截了，請調整後再試。";
  } else {
    logger.warn(`${logMsg} - Other HTTP Error`);
    userFacingMessage = "❌ 處理請求時發生 Discord 錯誤，請稍後再試。";
  }
  await sendErrorResponse(interaction, userFacingMessage);
}

/**
 * Records failed command statistics.
 * @param client - The Discord Client instance.
 * @param interaction - The Discord interaction object.
 * @param commandName - The name of the command.
 * @param error - The captured error object.
 */
async function recordFailedCommand(
  client: Client,
  interaction: Interaction,
  commandName: string,
  error: Error
): Promise<void> {
  // Placeholder for statistics service
  logger.debug(
    `[ErrorHandler] Statistics: Failed command recorded: ${commandName} by ${interaction.user.tag}. Reason: ${error.message}`
  );
}

/**
 * The main dispatcher for handling all errors originating from interactions.
 * @param interaction - The Discord interaction object.
 * @param error - The captured error object.
 * @param client - The Discord Client instance.
 */
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

  if (originalError instanceof CooldownError) {
    await handleCooldown(interaction, originalError, userInfo, commandName);
    return;
  }

  if (originalError instanceof CustomCheckError) {
    await handleCheckFailure(interaction, originalError, userInfo);
    return;
  }

  if (originalError instanceof BusinessError) {
    // Includes InsufficientBalanceError
    logger.error(
      `[ErrorHandler] Business logic error: command '${commandName}' by user ${userInfo}. Error: ${originalError.message}`
    );
    await sendErrorResponse(interaction, `⚠️ ${originalError.message}`);
    return;
  }

  if (originalError instanceof DiscordAPIError) {
    await handleDiscordHttpException(
      interaction,
      originalError,
      userInfo,
      commandName
    );
    return;
  }

  // --- Fallback for Unhandled Errors (Bugs) ---
  logger.error(
    `[ErrorHandler] Unhandled interaction error (BUG): command '${commandName}' by user ${userInfo}.`,
    originalError // Pass the full error object for stack tracing
  );

  await sendErrorResponse(
    interaction,
    "❌ 處理您的請求時發生了未知的內部錯誤，我們已收到通知並會盡快處理。",
    true
  );

  await recordFailedCommand(client, interaction, commandName, originalError);
}

/**
 * Handles client-level errors.
 * @param client - The Discord Client instance.
 * @param error - The captured error object.
 */
export function handleClientError(client: Client, error: Error): void {
  logger.error(`[ErrorHandler] Discord Client Error: ${error.message}`, error);
}

/**
 * Handles client-level warnings.
 * @param client - The Discord Client instance.
 * @param warning - The captured warning message.
 */
export function handleClientWarning(client: Client, warning: string): void {
  logger.warn(`[ErrorHandler] Discord Client Warning: ${warning}`);
}

/**
 * Records successful command execution statistics.
 * @param client - The Discord Client instance.
 * @param interaction - The Discord interaction object.
 * @param commandName - The name of the command.
 */
export async function recordSuccessfulCommand(
  client: Client,
  interaction: Interaction,
  commandName: string
): Promise<void> {
  // Placeholder for statistics service
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
