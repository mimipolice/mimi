import { ButtonInteraction, Client, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import { Services } from '../../interfaces/Command';

export default {
  name: 'confirm_close_request',
  execute: async function (
    interaction: ButtonInteraction,
    _client: Client,
    services: Services
  ) {
    // Extract the requester ID from the custom ID
    const [, requesterId] = interaction.customId.split(':');

    // Check if the person confirming is authorized
    const { ticketManager } = services;
    const ticket = await ticketManager.findTicketByChannel(interaction.channelId);

    if (!ticket) {
      await interaction.reply({
        content: '❌ This is not a valid ticket channel.',
        ephemeral: true,
      });
      return;
    }

    // Only the ticket owner or claimed staff can confirm
    const isAuthorized =
      interaction.user.id === ticket.ownerId ||
      interaction.user.id === ticket.claimedById;

    if (!isAuthorized) {
      await interaction.reply({
        content: '❌ Only the ticket owner or assigned staff can confirm closing.',
        ephemeral: true,
      });
      return;
    }

    // Show modal for close reason
    const modal = new ModalBuilder()
      .setCustomId('close_ticket_modal')
      .setTitle('Close Ticket');

    const reasonInput = new TextInputBuilder()
      .setCustomId('close_reason')
      .setLabel('Reason for closing (optional)')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false);

    const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput);
    modal.addComponents(firstActionRow);

    await interaction.showModal(modal);
    
    // Note: The button will be disabled after the modal is submitted
    // in the closeTicketModal handler
  },
};
