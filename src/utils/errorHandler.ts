// src/utils/errorHandler.ts

import {
  Client,
  Interaction,
  EmbedBuilder,
  DiscordAPIError,
  CommandInteraction,
  MessageFlags,
  InteractionReplyOptions,
  MessagePayload,
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
import type { LocalizationManager } from "../services/LocalizationManager";

/**
 * Minimal services interface needed for error handling.
 * This avoids circular dependency with full Services interface.
 */
export interface ErrorHandlerServices {
  localizationManager: LocalizationManager;
}

export type ErrorPayload = InteractionReplyOptions;

// Define Discord API error codes for readability
const DISCORD_API_ERROR_CODES = {
  MISSING_PERMISSIONS: 50013,
  USER_MISSING_PERMISSIONS: 50001, // Note: This is often the same as MISSING_ACCESS (50001)
  MISSING_ACCESS: 50001,
  AUTO_MODERATION_BLOCKED: 200000, // Example, actual code may vary
  UNKNOWN_INTERACTION: 10062,
  INTERACTION_ALREADY_ACKNOWLEDGED: 40060,
};

/**
 * Safely sends an error message to a Discord interaction.
 * Handles cases where the interaction has already been replied to or deferred.
 * @param interaction - The Discord interaction object.
 * @param payload - The error payload to display (can contain embeds or components).
 * @param ephemeral - Whether the error message should be ephemeral.
 */
export async function sendErrorResponse(
  interaction: Interaction,
  payload: ErrorPayload,
  ephemeral: boolean = true
): Promise<void> {
  try {
    if (!interaction.isRepliable()) {
      logger.debug(`[ErrorHandler] Interaction is not repliable, skipping error response.`);
      return;
    }

    // Merge flags properly - preserve existing flags and add ephemeral if needed
    // Important: Don't override IsComponentsV2 flag if present
    let replyFlags = payload.flags;
    if (ephemeral) {
      if (Array.isArray(replyFlags)) {
        // If flags is an array, add Ephemeral if not present
        if (!replyFlags.includes(MessageFlags.Ephemeral)) {
          replyFlags = [...replyFlags, MessageFlags.Ephemeral];
        }
      } else if (typeof replyFlags === "number") {
        // If flags is a bitfield number, add Ephemeral
        replyFlags = replyFlags | MessageFlags.Ephemeral;
      } else {
        // No existing flags, just use Ephemeral
        replyFlags = MessageFlags.Ephemeral;
      }
    }

    const replyOptions: InteractionReplyOptions = {
      ...payload,
      flags: replyFlags,
    };

    // For editReply, we need to handle flags specially
    // IsComponentsV2 must be preserved, but Ephemeral cannot be changed after defer
    // We construct editOptions without flags that can't be used in editReply
    const editOptions: Parameters<typeof interaction.editReply>[0] = {
      content: payload.content,
      embeds: payload.embeds,
      components: payload.components,
      files: payload.files,
      allowedMentions: payload.allowedMentions,
    };

    // Add IsComponentsV2 flag if present in original payload (required for Components v2)
    if (Array.isArray(payload.flags) && payload.flags.includes(MessageFlags.IsComponentsV2)) {
      (editOptions as { flags?: MessageFlags }).flags = MessageFlags.IsComponentsV2;
    }

    // Check interaction state before attempting to send
    if (interaction.replied) {
      // Already replied, use followUp
      await interaction.followUp(replyOptions);
    } else if (interaction.deferred) {
      // Deferred but not replied, use editReply (flags already set during defer)
      await interaction.editReply(editOptions);
    } else {
      // Not yet replied or deferred, use reply
      await interaction.reply(replyOptions);
    }
  } catch (e: unknown) {
    const err = e as { code?: number; message?: string };
    // If sending the error fails (e.g., interaction expired), log it appropriately
    if (err.code === DISCORD_API_ERROR_CODES.UNKNOWN_INTERACTION) {
      const payloadObj = payload as InteractionReplyOptions;
      const errorMessage =
        payloadObj.embeds?.[0] && 'description' in payloadObj.embeds[0]
          ? (payloadObj.embeds[0] as { description?: string }).description
          : "An unknown error occurred.";
      logger.warn(
        `[ErrorHandler] Failed to send error response: Interaction expired or was deleted. Original error: ${errorMessage}`
      );
    } else if (err.code === DISCORD_API_ERROR_CODES.INTERACTION_ALREADY_ACKNOWLEDGED) {
      // Interaction was already acknowledged, silently ignore to avoid cascading errors
      logger.debug(
        `[ErrorHandler] Interaction already acknowledged, attempted to send error but skipped to prevent cascade.`
      );
    } else {
      // Log other errors but don't throw to prevent error handler from causing more errors
      logger.error(
        `[ErrorHandler] Failed to send error response: ${err.message || 'Unknown error'}. Code: ${err.code || 'N/A'}`,
        e
      );
    }
  }
}

// --- Helper Functions for Specific Error Types ---

async function handleCheckFailure(
  interaction: Interaction,
  error: CustomCheckError,
  contextInfo: string,
  services: ErrorHandlerServices
): Promise<void> {
  const commandName = interaction.isCommand() ? interaction.commandName : "N/A";
  logger.warn(
    `[ErrorHandler] Command check failed: command '${commandName}' | ${contextInfo}. Error: ${error.message}`
  );
  await sendErrorResponse(
    interaction,
    createCheckFailureReply(
      services.localizationManager,
      interaction,
      error.message
    )
  );
}

async function handleMissingPermissions(
  interaction: Interaction,
  error: MissingPermissionsError,
  contextInfo: string,
  services: ErrorHandlerServices
): Promise<void> {
  const commandName = interaction.isCommand() ? interaction.commandName : "N/A";
  logger.warn(
    `[ErrorHandler] Permission check failed: command '${commandName}' | ${contextInfo}. Error: ${error.message}`
  );
  await sendErrorResponse(
    interaction,
    createMissingPermissionsReply(services.localizationManager, interaction)
  );
}

async function handleCooldown(
  interaction: Interaction,
  error: CooldownError,
  contextInfo: string,
  commandName: string,
  services: ErrorHandlerServices
): Promise<void> {
  const remaining = error.retryAfter;
  logger.warn(
    `[ErrorHandler] Command on cooldown: command '${commandName}' | ${contextInfo}, retryAfter: ${remaining.toFixed(
      2
    )}s`
  );
  await sendErrorResponse(
    interaction,
    createCooldownReply(services.localizationManager, interaction, remaining)
  );
}

async function handleDiscordHttpException(
  interaction: Interaction,
  error: DiscordAPIError,
  contextInfo: string,
  commandName: string,
  services: ErrorHandlerServices
): Promise<void> {
  const logMsg = `[ErrorHandler] Discord HTTP Error (Status: ${error.status}, Code: ${error.code}): source '${commandName}' | ${contextInfo}. Error: ${error.message}`;

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
      createMissingPermissionsReply(services.localizationManager, interaction)
    );
  } else if (
    error.message.toLowerCase().includes("automod") ||
    error.code === DISCORD_API_ERROR_CODES.AUTO_MODERATION_BLOCKED
  ) {
    logger.warn(`${logMsg} - AutoMod Blocked`);
    await sendErrorResponse(
      interaction,
      createAutoModBlockedReply(services.localizationManager, interaction)
    );
  } else {
    logger.warn(`${logMsg} - Other HTTP Error`);
    await sendErrorResponse(
      interaction,
      createDiscordErrorReply(services.localizationManager, interaction)
    );
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
  error: unknown,
  client: Client,
  services: ErrorHandlerServices
): Promise<void> {
  const contextInfo =
    `User: '${interaction.user.tag}' (${interaction.user.id}) | ` +
    `Guild: ${interaction.guildId || "N/A"} | ` +
    `Channel: ${interaction.channelId || "N/A"}`;
  const commandName = interaction.isCommand()
    ? (interaction as CommandInteraction).commandName
    : interaction.isMessageComponent() || interaction.isModalSubmit()
    ? `Component:${interaction.customId}`
    : "Unknown Interaction";

  // Extract original error if wrapped
  const errorObj = error as { original?: unknown };
  const originalError = errorObj.original ?? error;

  // --- Error Classification and Handling ---

  if (originalError instanceof CustomCheckError) {
    await handleCheckFailure(interaction, originalError, contextInfo, services);
  } else if (originalError instanceof MissingPermissionsError) {
    await handleMissingPermissions(
      interaction,
      originalError,
      contextInfo,
      services
    );
  } else if (originalError instanceof CooldownError) {
    await handleCooldown(
      interaction,
      originalError,
      contextInfo,
      commandName,
      services
    );
  } else if (originalError instanceof BusinessError) {
    logger.error(
      `[ErrorHandler] Business logic error: command '${commandName}' | ${contextInfo}. Error: ${originalError.message}`
    );
    await sendErrorResponse(
      interaction,
      createBusinessErrorReply(
        services.localizationManager,
        interaction,
        originalError.message
      )
    );
  } else if (originalError instanceof DiscordAPIError) {
    await handleDiscordHttpException(
      interaction,
      originalError,
      contextInfo,
      commandName,
      services
    );
  } else {
    // --- Fallback for Unhandled Errors (Bugs) ---
    const errForLog = originalError instanceof Error ? originalError : new Error(String(originalError));
    logger.error(
      `[ErrorHandler] Unhandled interaction error (BUG): command '${commandName}' | ${contextInfo}.`,
      errForLog
    );
    await sendErrorResponse(
      interaction,
      createInternalErrorReply(services.localizationManager, interaction)
    );
    await recordFailedCommand(client, interaction, commandName, errForLog);
  }
}

export function handleClientError(client: Client, error: Error): void {
  logger.error(`[ErrorHandler] Discord Client Error: ${error.message}`, error);
}

export function handleClientWarning(client: Client, warning: string): void {
  logger.warn(`[ErrorHandler] Discord Client Warning: ${warning}`);
}

// Export all functions in a single object for easy importing
export const errorHandler = {
  sendErrorResponse,
  handleInteractionError,
  handleClientError,
  handleClientWarning,
};
