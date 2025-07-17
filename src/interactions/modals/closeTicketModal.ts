import { ModalSubmitInteraction } from 'discord.js';
import { TicketManager } from '../../services/TicketManager';

export const name = 'close_ticket_modal';

export async function execute(interaction: ModalSubmitInteraction, ticketManager: TicketManager) {
  const reason = interaction.fields.getTextInputValue('close_reason');
  await interaction.deferReply();
  await ticketManager.close(interaction, reason);
}
