import { ButtonInteraction, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, Client } from 'discord.js';
import { Services } from '../../interfaces/Command';

export default {
  name: 'close_ticket',
  execute: async function (interaction: ButtonInteraction, _client: Client, _services: Services) {
    const modal = new ModalBuilder()
      .setCustomId('close_ticket_modal')
      .setTitle('Close Ticket');

    const reasonInput = new TextInputBuilder()
      .setCustomId('close_reason')
      .setLabel("Reason for closing (optional)")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false);

    const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput);

    modal.addComponents(firstActionRow);

    await interaction.showModal(modal);
  }
};
