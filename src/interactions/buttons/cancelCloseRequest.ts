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
        content: '<:notice:1444897740566958111> 這不是有效的客服單頻道。',
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
        content: '<:notice:1444897740566958111> 只有客服單擁有者或負責的客服人員可以取消此請求。',
        ephemeral: true,
      });
      return;
    }

    // Send a message indicating the request was cancelled
    const embed = new EmbedBuilder()
      .setTitle("<:notice:1444897740566958111> 關閉請求已取消")
      .setDescription(
        `${interaction.user} 已取消關閉請求。\n\n客服單將保持開啟狀態。`
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
