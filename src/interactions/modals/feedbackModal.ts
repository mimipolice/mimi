import { ModalSubmitInteraction } from 'discord.js';
import { Modal } from '../../interfaces/Modal';
import { addTicketFeedback } from '../../shared/database/queries';
import logger from '../../utils/logger';
import { sanitize } from '../../utils/sanitize';

const modal: Modal = {
    name: /^feedback_comment_modal:(\d):(\d+)$/,
    async execute(interaction: ModalSubmitInteraction) {
        const match = interaction.customId.match(/^feedback_comment_modal:(\d):(\d+)$/);
        if (!match) return;

        const rating = parseInt(match[1], 10);
        const ticketId = parseInt(match[2], 10);
        const comment = interaction.fields.getTextInputValue('feedback_comment');

        try {
            const sanitizedComment = sanitize(comment);
            await addTicketFeedback(ticketId, rating, sanitizedComment);
            await interaction.reply({ content: 'Thank you for your feedback!', ephemeral: true });
        } catch (error) {
            logger.error('Error processing feedback modal:', error);
            await interaction.reply({ content: 'There was an error processing your feedback. Please try again later.', ephemeral: true });
        }
    },
};

export default modal;
