import { ButtonInteraction, Client, EmbedBuilder } from 'discord.js';
import { Services } from '../../interfaces/Command';

export default {
  name: 'cancel_close_request',
  execute: async function (
    interaction: ButtonInteraction,
    _client: Client,
    services: Services
  ) {
    // Extract the requester ID from the custom ID
    const [, requesterId] = interaction.customId.split(':');

    // Check if the person canceling is authorized
    const { ticketManager } = services;
    const ticket = await ticketManager.findTicketByChannel(interaction.channelId);

    if (!ticket) {
      await interaction.reply({
        content: '❌ This is not a valid ticket channel.',
        ephemeral: true,
      });
      return;
    }

    // Only the ticket owner or claimed staff can cancel
    const isAuthorized =
      interaction.user.id === ticket.ownerId ||
      interaction.user.id === ticket.claimedById;

    if (!isAuthorized) {
      await interaction.reply({
        content: '❌ Only the ticket owner or assigned staff can cancel this request.',
        ephemeral: true,
      });
      return;
    }

    // Send a message indicating the request was cancelled
    const embed = new EmbedBuilder()
      .setTitle("❌ Close Request Cancelled")
      .setDescription(
        `${interaction.user} has cancelled the close request.\n\nThe ticket will remain open.`
      )
      .setColor(0x808080)
      .setTimestamp();

    await interaction.reply({
      embeds: [embed],
    });

    // Remove the buttons from the original message
    try {
      await interaction.message.edit({
        components: [],
      });
    } catch (error) {
      // Ignore if message is already deleted
    }
  },
};
