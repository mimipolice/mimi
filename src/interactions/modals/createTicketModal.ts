import { Modal } from '../../interfaces/Modal';

const modal: Modal = {
    name: 'create_ticket_modal',
    execute: async (interaction, ticketManager) => {
        if (!ticketManager) {
            return;
        }
        await interaction.deferReply({ ephemeral: true });
        const [_, ticketType] = interaction.customId.split(":");
        const issueDescription = interaction.fields.getTextInputValue('ticket_issue_description');
        await ticketManager.create(interaction, issueDescription, ticketType);
    },
};

export default modal;
