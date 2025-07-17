import { ButtonInteraction, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, Client } from 'discord.js';
import { Button } from '../../interfaces/Button';
import { SettingsManager } from '../../services/SettingsManager';
import { TicketManager } from '../../services/TicketManager';

export const name = 'close_ticket';

export async function execute(interaction: ButtonInteraction, _client: Client, _settingsManager: SettingsManager, _ticketManager: TicketManager) {
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
