import { Pool } from 'pg';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  Guild,
  ModalSubmitInteraction,
  TextChannel,
  User,
} from 'discord.js';
import { SettingsManager } from './SettingsManager';
import logger from '../utils/logger';
import { generateTranscript } from '../utils/transcript';
import { sanitize } from '../utils/sanitize';

export class TicketManager {
  private db: Pool;
  private settingsManager: SettingsManager;
  private client: Client;

  constructor(db: Pool, settingsManager: SettingsManager, client: Client) {
    this.db = db;
    this.settingsManager = settingsManager;
    this.client = client;
  }

  async create(
    interaction: ButtonInteraction | ModalSubmitInteraction,
    issueDescription?: string,
    ticketType?: string
  ) {
    const guild = interaction.guild as Guild;
    const user = interaction.user as User;

    const settings = await this.settingsManager.getSettings(guild.id);
    if (!settings || !settings.ticketCategoryId || !settings.staffRoleId) {
      return interaction.editReply('The ticket system has not been configured yet.');
    }

    const existingTicket = await this.db.query(
      'SELECT * FROM tickets WHERE "guildId" = $1 AND "ownerId" = $2 AND status = \'OPEN\'',
      [guild.id, user.id]
    );

    if (existingTicket.rows.length > 0) {
      return interaction.editReply(`You already have an open ticket: <#${existingTicket.rows[0].channelId}>`);
    }

    const ticketChannel = await guild.channels.create({
      name: `ticket-${user.username}`,
      type: ChannelType.GuildText,
      parent: settings.ticketCategoryId,
      permissionOverwrites: [
        {
          id: guild.id,
          deny: ['ViewChannel'],
        },
        {
          id: user.id,
          allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'],
        },
        {
          id: settings.staffRoleId,
          allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'],
        },
      ],
    });

    try {
      await this.db.query(
        'INSERT INTO tickets ("guildId", "channelId", "ownerId", "ticketType") VALUES ($1, $2, $3, $4)',
        [guild.id, ticketChannel.id, user.id, ticketType]
      );
    } catch (error: any) {
      if (error.code === '23503') {
        this.settingsManager.clearCache(interaction.guildId!);
        await interaction.editReply({
          content: "A configuration error occurred. The settings cache has been cleared. Please try creating a ticket again. If the issue persists, an administrator may need to run `/config set`.",
        });
        return;
      }
      throw error;
    }

    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('close_ticket')
          .setLabel('關閉客服單')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('claim_ticket')
          .setLabel('接手客服單')
          .setStyle(ButtonStyle.Success),
      );

    const embed = new EmbedBuilder()
      .setAuthor({ name: user.username, iconURL: user.displayAvatarURL() })
      .setTitle('New Support Ticket')
      .setDescription(`Welcome, <@${user.id}>! A staff member will be with you shortly.`)
      .addFields(
        { name: 'Type', value: ticketType || 'General' },
        { name: 'Issue', value: issueDescription || 'No issue description provided.' }
      )
      .setTimestamp();

    await ticketChannel.send({
      embeds: [embed],
      components: [row],
    });

    await ticketChannel.send({
      content: `Cảm ơn bạn đã liên hệ với chúng tôi, <@${user.id}>! <:newticket:1327350182499123291> Một nhân viên (<@&${settings.staffRoleId}>) sẽ sớm hỗ trợ bạn.`,
    });

    return interaction.editReply(`Your ticket has been created: ${ticketChannel}`);
  }

  async close(interaction: ModalSubmitInteraction, reason: string) {
    const guild = interaction.guild as Guild;
    const channel = interaction.channel as TextChannel;

    const ticket = await this.db.query('SELECT * FROM tickets WHERE "channelId" = $1', [channel.id]);
    if (ticket.rows.length === 0) {
      return interaction.editReply('This is not a valid ticket channel.');
    }

    const owner = await this.client.users.fetch(ticket.rows[0].ownerId);

    // Generate transcript
    const transcript = await generateTranscript(channel);

    const sanitizedReason = sanitize(reason);
    const ticketData = ticket.rows[0];
    const openTime = Math.floor(new Date(ticketData.createdAt).getTime() / 1000);

    const settings = await this.settingsManager.getSettings(guild.id);
    if (settings && settings.logChannelId) {
      const logChannel = await guild.channels.fetch(settings.logChannelId) as TextChannel;

      const embed = new EmbedBuilder()
        .setTitle('Ticket Closed')
        .setColor(0x32a852)
        .setTimestamp()
        .addFields(
          { name: '<:id:1327350136170479638> Ticket ID', value: ticketData.id.toString(), inline: true },
          { name: '<:open:1327350149684400268> Opened By', value: `<@${owner.id}>`, inline: true },
          { name: '<:close:1327350171121614870> Closed By', value: `<@${interaction.user.id}>`, inline: true },
          { name: '<:opentime:1327350161206153227> Open Time', value: `<t:${openTime}:f>`, inline: true },
          { name: '<:claim:1327350259965235233> Claimed By', value: ticketData.claimedById ? `<@${ticketData.claimedById}>` : 'Not claimed', inline: true },
          { name: '​', value: '‎', inline: true },
          { name: '<:reason:1327350192801972224> Reason', value: sanitizedReason || 'No reason specified', inline: false },
        );

      await logChannel.send({ embeds: [embed], files: [transcript] });
    }

    await this.db.query(
      'UPDATE tickets SET status = \'CLOSED\', "closeReason" = $1, "closedById" = $2, "closedAt" = NOW() WHERE "channelId" = $3',
      [sanitizedReason, interaction.user.id, channel.id]
    );

    await channel.permissionOverwrites.edit(owner.id, { ViewChannel: false });
    await channel.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: false });

    if (settings && settings.archiveCategoryId) {
      try {
        await channel.setParent(settings.archiveCategoryId);
      } catch (error) {
        logger.warn(`Failed to move channel ${channel.id} to archive category.`, error);
      }
    }

    try {
        const ratingButtons = new ActionRowBuilder<ButtonBuilder>();
        for (let i = 1; i <= 5; i++) {
            ratingButtons.addComponents(
                new ButtonBuilder()
                    .setCustomId(`rate_ticket:${i}:${ticketData.id}`)
                    .setLabel('⭐'.repeat(i))
                    .setStyle(ButtonStyle.Primary)
            );
        }

        const dmEmbed = new EmbedBuilder()
            .setAuthor({ name: guild.name, iconURL: guild.iconURL() || undefined })
            .setTitle('Ticket Closed')
            .setColor(0x32a852)
            .setTimestamp()
            .addFields(
                { name: 'Ticket ID', value: ticketData.id.toString(), inline: true },
                { name: 'Opened By', value: `<@${owner.id}>`, inline: true },
                { name: 'Closed By', value: `<@${interaction.user.id}>`, inline: true },
                { name: 'Open Time', value: `<t:${openTime}:f>`, inline: true },
                { name: 'Claimed By', value: ticketData.claimedById ? `<@${ticketData.claimedById}>` : 'Not claimed', inline: true },
                { name: 'Reason', value: sanitizedReason || 'No reason specified', inline: false },
            );

      await owner.send({
        embeds: [dmEmbed],
        components: [ratingButtons]
      });
    } catch (error) {
      logger.warn(`Could not DM user ${owner.id}`, error);
    }

    return interaction.editReply('Ticket closed.');
  }
}
