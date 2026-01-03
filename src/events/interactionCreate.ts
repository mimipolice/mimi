import { Interaction, Client } from "discord.js";
import { Command, Services, Databases } from "../interfaces/Command";
import logger from "../utils/logger";
import { errorHandler } from "../utils/errorHandler";
import { withRetry } from "../utils/withRetry";
import { handleHelpInteraction } from "./handlers/helpInteractionHandler";
import reportViewHandler from "../interactions/buttons/reportView";
import redisClient from "../shared/redis";

export const name = "interactionCreate";

/**
 * Acquire a distributed lock for an interaction using Redis SET NX EX.
 * Returns true if lock was acquired (this process should handle it),
 * false if another process already claimed it.
 */
async function acquireInteractionLock(interactionId: string): Promise<boolean> {
  if (!redisClient?.isReady) {
    // Redis not available, allow processing (single instance assumed)
    return true;
  }

  try {
    // SET key value NX EX 30 - only set if not exists, expire in 30 seconds
    // 30 seconds allows for longer operations like transcript generation while
    // still providing eventual cleanup for orphaned locks
    const result = await redisClient.set(
      `interaction:lock:${interactionId}`,
      process.pid.toString(),
      { NX: true, EX: 30 }
    );
    return result === "OK";
  } catch (error) {
    logger.warn("Failed to acquire interaction lock:", error);
    // On Redis error, allow processing to avoid blocking all interactions
    return true;
  }
}

/**
 * Release a distributed lock for an interaction.
 * Uses a Lua script for atomic compare-and-delete to prevent race conditions.
 */
async function releaseInteractionLock(interactionId: string): Promise<void> {
  if (!redisClient?.isReady) {
    return;
  }

  try {
    const key = `interaction:lock:${interactionId}`;
    const expectedValue = process.pid.toString();

    // Atomic compare-and-delete using Lua script
    // Only deletes if the current value matches our PID
    const script = `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("DEL", KEYS[1])
      else
        return 0
      end
    `;
    await redisClient.eval(script, { keys: [key], arguments: [expectedValue] });
  } catch (error) {
    // Non-critical - lock will expire anyway
    logger.debug("Failed to release interaction lock:", error);
  }
}

export async function execute(
  interaction: Interaction,
  client: Client,
  services: Services,
  databases: Databases
) {
  const { gachaDb, ticketDb } = databases;
  logger.debug(
    `Received interaction: ${interaction.type} | Custom ID: ${
      "customId" in interaction ? interaction.customId : "N/A"
    }`
  );

  // Acquire distributed lock to prevent duplicate processing across instances
  const lockAcquired = await acquireInteractionLock(interaction.id);
  if (!lockAcquired) {
    logger.debug(
      `Interaction ${interaction.id} already being handled by another instance`
    );
    return;
  }

  try {
    if (
      interaction.isMessageComponent() &&
      interaction.customId.startsWith("help:")
    ) {
      return handleHelpInteraction(interaction, services);
    }

    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName) as Command;
      if (!command) return;
      const startTime = Date.now();
      await withRetry(
        () => command.execute(interaction, client, services, databases),
        `Command: ${interaction.commandName}`
      );
      const executionTime = Date.now() - startTime;
      errorHandler.recordSuccessfulCommand(
        client,
        interaction,
        interaction.commandName,
        executionTime
      );
    } else if (interaction.isContextMenuCommand()) {
      const command = client.commands.get(interaction.commandName) as Command;
      if (!command) return;
      const startTime = Date.now();
      await command.execute(interaction, client, services, databases);
      const executionTime = Date.now() - startTime;
      errorHandler.recordSuccessfulCommand(
        client,
        interaction,
        interaction.commandName,
        executionTime
      );
    } else if (
      interaction.isButton() &&
      interaction.customId.startsWith("report-")
    ) {
      await reportViewHandler.execute(interaction, client, services, databases);
      errorHandler.recordSuccessfulCommand(
        client,
        interaction,
        interaction.customId
      );
    } else if (interaction.isButton()) {
      const button = client.buttons.find((b) => {
        if (typeof b.name === "string") {
          return interaction.customId.startsWith(b.name);
        } else if (b.name instanceof RegExp) {
          return b.name.test(interaction.customId);
        }
        return false;
      });
      if (!button) return;
      await button.execute(interaction, client, services, databases);
      errorHandler.recordSuccessfulCommand(
        client,
        interaction,
        interaction.customId
      );
    } else if (interaction.isModalSubmit()) {
      const modal = client.modals.find((m) => {
        if (typeof m.name === "string") {
          return interaction.customId.startsWith(m.name);
        }
        return false;
      });
      if (!modal) return;
      await modal.execute(interaction, services, databases);
      errorHandler.recordSuccessfulCommand(
        client,
        interaction,
        interaction.customId
      );
    } else if (interaction.isStringSelectMenu()) {
      const menu = client.selectMenus.find((m) => {
        if (typeof m.name === "string") {
          return interaction.customId.startsWith(m.name);
        } else if (m.name instanceof RegExp) {
          return m.name.test(interaction.customId);
        }
        return false;
      });
      if (!menu) return;
      await menu.execute(interaction, services, databases);
      errorHandler.recordSuccessfulCommand(
        client,
        interaction,
        interaction.customId
      );
    } else if (interaction.isAutocomplete()) {
      const command = client.commands.get(interaction.commandName);
      if (!command || !command.autocomplete) return;
      await command.autocomplete(interaction, gachaDb, ticketDb);
      // No success recording for autocomplete
    }
  } catch (error) {
    errorHandler.handleInteractionError(interaction, error, client, services);
  } finally {
    // Always release the lock when done (success or error)
    await releaseInteractionLock(interaction.id);
  }
}
