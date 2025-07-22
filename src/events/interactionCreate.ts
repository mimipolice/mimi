import { Interaction, Client } from "discord.js";
import { Button } from "../interfaces/Button";
import { Command } from "../interfaces/Command";
import { SettingsManager } from "../services/SettingsManager";
import { TicketManager } from "../services/TicketManager";
import logger from "../utils/logger";
import { errorHandler } from "../utils/errorHandler";
import { Kysely } from "kysely";
import { SelectMenu } from "../interfaces/SelectMenu";
import { Modal } from "../interfaces/Modal";
import { createContinueModal } from "../interactions/modals/aiContinueModal";
import { MessageFlags } from "discord-api-types/v10";

export const name = "interactionCreate";

export async function execute(
  interaction: Interaction,
  client: Client,
  settingsManager: SettingsManager,
  ticketManager: TicketManager,
  gachaDb: Kysely<any>,
  ticketDb: Kysely<any>
) {
  logger.debug(
    `Received interaction: ${interaction.type} | Custom ID: ${
      "customId" in interaction ? interaction.customId : "N/A"
    }`
  );
  try {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName) as Command;
      if (!command) return;
      await command.execute(
        interaction,
        client,
        settingsManager,
        ticketManager,
        gachaDb,
        ticketDb
      );
      errorHandler.recordSuccessfulCommand(
        client,
        interaction,
        interaction.commandName
      );
    } else if (interaction.isContextMenuCommand()) {
      const command = client.commands.get(interaction.commandName) as Command;
      if (!command) return;
      await command.execute(
        interaction,
        client,
        settingsManager,
        ticketManager,
        gachaDb,
        ticketDb
      );
      errorHandler.recordSuccessfulCommand(
        client,
        interaction,
        interaction.commandName
      );
    } else if (interaction.isButton()) {
      if (interaction.customId.startsWith("ai_continue")) {
        const conversationIdStr = interaction.customId.split("_")[2];
        const conversationId = parseInt(conversationIdStr, 10);
        if (isNaN(conversationId)) {
          // Handle case where there's no existing conversation
          const modal = createContinueModal(0); // Use a placeholder or handle differently
          await interaction.showModal(modal);
          return;
        }
        const modal = createContinueModal(conversationId);
        await interaction.showModal(modal);
        return;
      }

      const button = client.buttons.find((b) => {
        if (typeof b.name === "string") {
          return interaction.customId.startsWith(b.name);
        }
        return false;
      });
      if (!button) return;
      await button.execute(interaction, client, settingsManager, ticketManager);
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
      await modal.execute(interaction, ticketManager);
      errorHandler.recordSuccessfulCommand(
        client,
        interaction,
        interaction.customId
      );
    } else if (interaction.isStringSelectMenu()) {
      const menu = client.selectMenus.find((m) => {
        if (typeof m.name === "string") {
          return interaction.customId.startsWith(m.name);
        }
        return false;
      });
      if (!menu) return;
      await menu.execute(interaction);
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
    errorHandler.handleInteractionError(interaction, error, client);
  }
}
