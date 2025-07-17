import { ModalSubmitInteraction } from 'discord.js';
import { TicketManager } from '../../services/TicketManager';

export default {
  name: 'close_ticket_modal',
  execute: async function (interaction: ModalSubmitInteraction, ticketManager: TicketManager) {
    const reason = interaction.fields.getTextInputValue('close_reason');
    await interaction.deferReply();
    await ticketManager.close(interaction, reason);
  }
};
