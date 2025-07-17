import { ButtonInteraction, PermissionFlagsBits, ButtonBuilder } from 'discord.js';
import { Button } from '../../interfaces/Button';
import { pool } from '../../shared/database/queries';

export const button: Button = {
  name: /^confirm_purge:(\d+)$/,
  async execute(interaction: ButtonInteraction) {
    await interaction.deferUpdate();

    const match = interaction.customId.match(/^confirm_purge:(\d+)$/);
    if (!match) return;

    const originalUserId = match[1];

    if (interaction.user.id !== originalUserId) {
      await interaction.followUp({ content: 'Only the user who initiated the purge can confirm it.', ephemeral: true });
      return;
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.followUp({ content: 'You no longer have permission to do this.', ephemeral: true });
      return;
    }

    try {
      await pool.query('TRUNCATE TABLE tickets RESTART IDENTITY;');
      
      const disabledButton = ButtonBuilder.from(interaction.component).setDisabled(true);
      await interaction.editReply({
        content: '✅ All ticket records have been permanently deleted and the ID counter has been reset.',
        components: [{ type: 1, components: [disabledButton] }],
      });
    } catch (error) {
      console.error('Failed to purge tickets:', error);
      await interaction.editReply({
        content: 'An error occurred while trying to purge the tickets. Please check the logs.',
        components: [],
      });
    }
  },
};
