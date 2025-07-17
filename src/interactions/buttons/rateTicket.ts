import {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    ButtonInteraction,
} from 'discord.js';

export default {
    name: /^rate_ticket:(\d):(\d+)$/,
    execute: async (interaction: ButtonInteraction) => {
        const match = interaction.customId.match(/^rate_ticket:(\d):(\d+)$/);
        if (!match) return;

        const rating = match[1];
        const ticketId = match[2];

        const modal = new ModalBuilder()
            .setCustomId(`feedback_comment_modal:${rating}:${ticketId}`)
            .setTitle('Provide Feedback');

        const commentInput = new TextInputBuilder()
            .setCustomId('feedback_comment')
            .setLabel('Please provide any additional comments.')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false);

        const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(commentInput);
        modal.addComponents(actionRow);

        await interaction.showModal(modal);
    },
};
