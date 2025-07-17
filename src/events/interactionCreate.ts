import { Interaction, Client } from 'discord.js';
import { Button } from '../interfaces/Button';
import { Command } from '../interfaces/Command';
import { SettingsManager } from '../services/SettingsManager';
import { TicketManager } from '../services/TicketManager';
import logger from '../utils/logger';
import { Pool } from 'pg';
import { SelectMenu } from '../interfaces/SelectMenu';
import { Modal } from '../interfaces/Modal';

export const name = 'interactionCreate';

export async function execute(
  interaction: Interaction,
  client: Client,
  settingsManager: SettingsManager,
  ticketManager: TicketManager,
  db: Pool
) {
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName) as Command;
    if (!command) return;

    try {
      await command.execute(interaction, client, settingsManager, ticketManager, db);
    } catch (error) {
      logger.error('Error executing command:', error);
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
      } else {
        await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
      }
    }
  } else if (interaction.isButton()) {
    const button = [...client.buttons.values()].find(b => {
      if (typeof b.name === 'string') {
        return interaction.customId.startsWith(b.name);
      }
      return b.name.test(interaction.customId);
    }) as Button;
    if (!button) return;

    try {
      await button.execute(interaction, client, settingsManager, ticketManager);
    } catch (error) {
      logger.error('Error executing button:', error);
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: 'There was an error while executing this button!', ephemeral: true });
      } else {
        await interaction.reply({ content: 'There was an error while executing this button!', ephemeral: true });
      }
    }
  } else if (interaction.isModalSubmit()) {
    const modal = [...client.modals.values()].find(m => {
      if (typeof m.name === 'string') {
        return interaction.customId.startsWith(m.name);
      }
      return m.name.test(interaction.customId);
    }) as Modal;
    if (!modal) return;

    try {
      await modal.execute(interaction, ticketManager);
    } catch (error) {
      logger.error('Error executing modal:', error);
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: 'There was an error while executing this modal!', ephemeral: true });
      } else {
        await interaction.reply({ content: 'There was an error while executing this modal!', ephemeral: true });
      }
    }
  } else if (interaction.isStringSelectMenu()) {
    const menu = [...client.selectMenus.values()].find(m => {
      if (typeof m.name === 'string') {
        return interaction.customId.startsWith(m.name);
      }
      return m.name.test(interaction.customId);
    }) as SelectMenu;
    if (!menu) return;

    try {
      await menu.execute(interaction);
    } catch (error) {
      logger.error('Error executing select menu:', error);
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: 'There was an error while executing this menu!', ephemeral: true });
      } else {
        await interaction.reply({ content: 'There was an error while executing this menu!', ephemeral: true });
      }
    }
  }
}
