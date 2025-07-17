import { ButtonInteraction, EmbedBuilder, GuildMember, Client } from 'discord.js';
import { pool } from '../../shared/database/queries';
import { SettingsManager } from '../../services/SettingsManager';
import { TicketManager } from '../../services/TicketManager';
import { MessageFlags } from "discord-api-types/v10";

export default {
  name: 'claim_ticket',
  execute: async function (interaction: ButtonInteraction, _client: Client, settingsManager: SettingsManager, _ticketManager: TicketManager) {
    if (!interaction.guild || !settingsManager) return;

    const settings = await settingsManager.getSettings(interaction.guild.id);
    const member = interaction.member as GuildMember;

    if (!settings || !settings.staffRoleId) {
      return interaction.reply({ content: 'The staff role has not been configured for this server.', flags: MessageFlags.Ephemeral });
    }

    if (!member.roles.cache.has(settings.staffRoleId)) {
      return interaction.reply({ content: 'You do not have permission to claim this ticket.', flags: MessageFlags.Ephemeral });
    }

    const channelId = interaction.channelId;

    const ticketResult = await pool.query('SELECT * FROM tickets WHERE "channelId" = $1', [channelId]);
    const ticket = ticketResult.rows[0];

    if (ticket.claimedById) {
      return interaction.reply({ content: 'This ticket has already been claimed.', flags: MessageFlags.Ephemeral });
    }

    await pool.query('UPDATE tickets SET "claimedById" = $1 WHERE "channelId" = $2', [interaction.user.id, channelId]);

    const originalMessage = await interaction.channel?.messages.fetch(interaction.message.id);
    if (originalMessage) {
      const updatedEmbed = new EmbedBuilder(originalMessage.embeds[0].toJSON())
        .addFields({ name: 'Claimed by', value: `<@${interaction.user.id}>` });

      await originalMessage.edit({ embeds: [updatedEmbed] });
    }

    return interaction.reply({ content: 'You have claimed this ticket.', flags: MessageFlags.Ephemeral });
  }
};
