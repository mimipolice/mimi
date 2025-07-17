import { ModalSubmitInteraction } from 'discord.js';
import { TicketManager } from '../../services/TicketManager';
import { MessageFlags } from "discord-api-types/v10";
export default {
    name: 'create_ticket_modal',
    execute: async (interaction: ModalSubmitInteraction, ticketManager: TicketManager) => {
        if (!ticketManager) {
            return;
        }
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const [_, ticketType] = interaction.customId.split(":");
        const issueDescription = interaction.fields.getTextInputValue('ticket_issue_description');
        await ticketManager.create(interaction, issueDescription, ticketType);
    },
};
