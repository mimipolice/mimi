import { ChannelType, SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { Command } from '../../interfaces/Command';
import { TicketManager } from '../../services/TicketManager';
import { pool } from '../../shared/database/queries';

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Ticket commands.')
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Add a user to a ticket.')
        .addUserOption(option => option.setName('user').setDescription('The user to add.').setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove a user from a ticket.')
        .addUserOption(option => option.setName('user').setDescription('The user to remove.').setRequired(true))
    ),
  async execute(interaction, client, settingsManager, ticketManager: TicketManager) {
    if (!interaction.isChatInputCommand()) return;

    await interaction.deferReply({ ephemeral: true });

    const subcommand = interaction.options.getSubcommand();
    const user = interaction.options.getUser('user');
    const channel = interaction.channel;

    if (!user) {
      await interaction.editReply({ content: 'User not found.' });
      return;
    }

    if (!channel || channel.type !== ChannelType.GuildText) {
      await interaction.editReply({ content: 'This command can only be used in a ticket channel.' });
      return;
    }

    const ticketResult = await pool.query('SELECT * FROM tickets WHERE "channelId" = $1', [interaction.channelId]);

    if (ticketResult.rowCount === 0) {
      await interaction.editReply({ content: 'This is not a valid ticket channel.' });
      return;
    }

    if (subcommand === 'add') {
      await channel.permissionOverwrites.edit(user.id, {
        ViewChannel: true,
      });
      await interaction.editReply({ content: `Successfully added ${user.tag} to the ticket.` });
    } else if (subcommand === 'remove') {
      await channel.permissionOverwrites.edit(user.id, {
        ViewChannel: false,
      });
      await interaction.editReply({ content: `Successfully removed ${user.tag} from the ticket.` });
    }
  },
};
