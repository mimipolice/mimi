import { EmbedBuilder, ModalSubmitInteraction, TextChannel } from 'discord.js';
import { Modal } from '../../interfaces/Modal';
import { addTicketFeedback } from '../../shared/database/queries';
import logger from '../../utils/logger';
import { sanitize } from '../../utils/sanitize';
import { SettingsManager } from '../../services/SettingsManager';
import { pool } from '../../shared/database/queries';

const settingsManager = new SettingsManager(pool);

const modal: Modal = {
    name: /^feedback_comment_modal:(\d):(\d+)$/,
    async execute(interaction: ModalSubmitInteraction) {
        const match = interaction.customId.match(/^feedback_comment_modal:(\d):(\d+)$/);
        if (!match || !interaction.guild) return;

        const rating = parseInt(match[1], 10);
        const ticketId = parseInt(match[2], 10);
        const comment = interaction.fields.getTextInputValue('feedback_comment');

        try {
            const sanitizedComment = sanitize(comment);
            const ticket = await addTicketFeedback(ticketId, rating, sanitizedComment);

            if (ticket && ticket.logMessageId) {
                const settings = await settingsManager.getSettings(interaction.guild.id);
                if (!settings || !settings.logChannelId) return;

                const logChannel = await interaction.guild.channels.fetch(settings.logChannelId) as TextChannel;
                if (!logChannel) return;

                try {
                    const logMessage = await logChannel.messages.fetch(ticket.logMessageId);
                    const originalEmbed = logMessage.embeds[0];
                    if (!originalEmbed) return;

                    const newEmbed = new EmbedBuilder(originalEmbed.toJSON())
                        .addFields({ name: 'Rating', value: `${'⭐'.repeat(rating)} (${rating}/5)`, inline: true });

                    await logMessage.edit({ embeds: [newEmbed] });
                } catch (msgError) {
                    logger.error(`Could not find or edit log message ${ticket.logMessageId} for ticket ${ticketId}`, msgError);
                }
            }

            await interaction.reply({ content: 'Thank you for your feedback!', ephemeral: true });
        } catch (error) {
            logger.error('Error processing feedback modal:', error);
            await interaction.reply({ content: 'There was an error processing your feedback. Please try again later.', ephemeral: true });
        }
    },
};

export default modal;
