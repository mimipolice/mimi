import { Interaction, Client } from "discord.js";
import { Button } from "../interfaces/Button";
import { Command } from "../interfaces/Command";
import { SettingsManager } from "../services/SettingsManager";
import { TicketManager } from "../services/TicketManager";
import logger from "../utils/logger";
import { Kysely } from "kysely";
import { SelectMenu } from "../interfaces/SelectMenu";
import { Modal } from "../interfaces/Modal";
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
  console.log(
    `[DEBUG] Received interaction: ${interaction.type} | Custom ID: ${
      "customId" in interaction ? interaction.customId : "N/A"
    }`
  );

  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName) as Command;
    if (!command) return;

    try {
      await command.execute(
        interaction,
        client,
        settingsManager,
        ticketManager,
        gachaDb,
        ticketDb
      );
    } catch (error) {
      logger.error("Error executing command:", error);
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({
          content: "There was an error while executing this command!",
          flags: MessageFlags.Ephemeral,
        });
      } else {
        await interaction.reply({
          content: "There was an error while executing this command!",
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  } else if (interaction.isButton()) {
    const button = client.buttons.find((b) => {
      if (typeof b.name === "string") {
        return interaction.customId.startsWith(b.name);
      }
      return false;
    });
    if (!button) return;

    try {
      await button.execute(interaction, client, settingsManager, ticketManager);
    } catch (error) {
      logger.error("Error executing button:", error);
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({
          content: "There was an error while executing this button!",
          flags: MessageFlags.Ephemeral,
        });
      } else {
        await interaction.reply({
          content: "There was an error while executing this button!",
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  } else if (interaction.isModalSubmit()) {
    const modal = client.modals.find((m) => {
      if (typeof m.name === "string") {
        return interaction.customId.startsWith(m.name);
      }
      return false;
    });
    if (!modal) return;

    try {
      await modal.execute(interaction, ticketManager);
    } catch (error) {
      logger.error("Error executing modal:", error);
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({
          content: "There was an error while executing this modal!",
          flags: MessageFlags.Ephemeral,
        });
      } else {
        await interaction.reply({
          content: "There was an error while executing this modal!",
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  } else if (interaction.isStringSelectMenu()) {
    const menu = client.selectMenus.find((m) => {
      if (typeof m.name === "string") {
        return interaction.customId.startsWith(m.name);
      }
      return false;
    });
    if (!menu) return;

    try {
      await menu.execute(interaction);
    } catch (error) {
      logger.error("Error executing select menu:", error);
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({
          content: "There was an error while executing this menu!",
          flags: MessageFlags.Ephemeral,
        });
      } else {
        await interaction.reply({
          content: "There was an error while executing this menu!",
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  } else if (interaction.isAutocomplete()) {
    const command = client.commands.get(interaction.commandName);

    if (!command || !command.autocomplete) return;

    try {
      await command.autocomplete(interaction, gachaDb, ticketDb);
    } catch (error) {
      logger.error("Error executing autocomplete:", error);
    }
  }
}
