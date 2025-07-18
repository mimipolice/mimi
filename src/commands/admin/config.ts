import { ChatInputCommandInteraction, Client, SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { Command } from '../../interfaces/Command';
import { SettingsManager } from '../../services/SettingsManager';
import { TicketManager } from '../../services/TicketManager';
import { MessageFlags } from "discord-api-types/v10";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configure the ticket bot for this server.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('set')
        .setDescription('Set a configuration value.')
        .addRoleOption(option => option.setName('staff_role').setDescription('The role for ticket staff.').setRequired(true))
        .addChannelOption(option => option.setName('ticket_category').setDescription('The category to create tickets in.').setRequired(true))
        .addChannelOption(option => option.setName('log_channel').setDescription('The channel to log ticket events to.').setRequired(true))
        .addChannelOption(option => option.setName('panel_channel').setDescription('The channel to send the ticket panel to.').setRequired(true))
        .addChannelOption(option => option.setName('archive_category').setDescription('The category to archive tickets in.').setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('view')
        .setDescription('View the current configuration.')
    ),
  async execute(
    interaction: ChatInputCommandInteraction,
    client: Client,
    settingsManager: SettingsManager,
    _ticketManager: TicketManager
  ) {
    if (!interaction.isChatInputCommand()) return;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'set') {
      const staffRoleId = interaction.options.getRole('staff_role')?.id;
      const ticketCategoryId = interaction.options.getChannel('ticket_category')?.id;
      const logChannelId = interaction.options.getChannel('log_channel')?.id;
      const panelChannelId = interaction.options.getChannel('panel_channel')?.id;
      const archiveCategoryId = interaction.options.getChannel('archive_category')?.id;

      if (staffRoleId && ticketCategoryId && logChannelId && panelChannelId && archiveCategoryId) {
        await settingsManager.updateSettings(interaction.guildId!, {
          staffRoleId: staffRoleId,
          ticketCategoryId: ticketCategoryId,
          logChannelId: logChannelId,
          panelChannelId: panelChannelId,
          archiveCategoryId: archiveCategoryId,
        });
        await interaction.editReply({ content: 'Configuration updated successfully.' });
      } else {
        await interaction.editReply({ content: 'Please provide all the required options.' });
      }
    } else if (subcommand === 'view') {
      const settings = await settingsManager.getSettings(interaction.guildId!);
      if (settings) {
        await interaction.editReply({
          content: `
**Current Configuration:**
- Staff Role: <@&${settings.staffRoleId}>
- Ticket Category: <#${settings.ticketCategoryId}>
- Log Channel: <#${settings.logChannelId}>
- Panel Channel: <#${settings.panelChannelId}>
- Archive Category: <#${settings.archiveCategoryId}>
          `,
        });
      } else {
        await interaction.editReply({ content: 'No configuration found for this server.' });
      }
    }
  },
};
