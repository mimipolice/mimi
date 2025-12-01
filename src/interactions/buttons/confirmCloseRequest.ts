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
        content: '<:notice:1444897740566958111> 這不是有效的客服單頻道。',
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
        content: '<:notice:1444897740566958111> 只有客服單擁有者或負責的客服人員可以確認關閉。',
        ephemeral: true,
      });
      return;
    }

    // Show modal for close reason
    const modal = new ModalBuilder()
      .setCustomId('close_ticket_modal')
      .setTitle('關閉客服單');

    const reasonInput = new TextInputBuilder()
      .setCustomId('close_reason')
      .setLabel('關閉原因（選填）')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false);

    const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput);
    modal.addComponents(firstActionRow);

    await interaction.showModal(modal);
    
    // Note: The button will be disabled after the modal is submitted
    // in the closeTicketModal handler
  },
};
