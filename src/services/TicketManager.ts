import { Kysely } from "kysely";
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
  OverwriteResolvable,
  Embed,
} from "discord.js";
import { SettingsManager } from "./SettingsManager";
import logger from "../utils/logger";
import { generateTranscript } from "../utils/transcript";
import { sanitize } from "../utils/sanitize";
import { DB } from "../shared/database/types";
import { TicketRepository, Ticket } from "./TicketRepository";
import { TicketStatus, TicketAction } from "../types/ticket";
import { GuildSettings } from "./SettingsManager";

export class TicketManager {
  private db: Kysely<DB>;
  private settingsManager: SettingsManager;
  private client: Client;
  private ticketRepository: TicketRepository;

  constructor(
    db: Kysely<DB>,
    settingsManager: SettingsManager,
    client: Client
  ) {
    this.db = db;
    this.settingsManager = settingsManager;
    this.client = client;
    this.ticketRepository = new TicketRepository(db);
  }

  async create(
    interaction: ButtonInteraction | ModalSubmitInteraction,
    issueDescription?: string,
    ticketType?: string
  ) {
    if (!interaction.inGuild() || !interaction.guild) {
      // Should not happen, but good practice
      return interaction.editReply(
        "This command can only be used in a server."
      );
    }

    const guild = interaction.guild;
    const user = interaction.user;

    try {
      const settings = await this._validateAndGetSettings(guild.id);
      await this._checkForExistingTicket(guild.id, user.id);

      const maxId = await this.ticketRepository.findMaxGuildTicketId(guild.id);
      const newGuildTicketId = (maxId || 0) + 1;

      const channel = await this._createTicketChannel(
        guild,
        user,
        settings,
        newGuildTicketId
      );

      await this.ticketRepository.createTicket({
        guildId: guild.id,
        guildTicketId: newGuildTicketId,
        channelId: channel.id,
        ownerId: user.id,
      });

      await this._sendInitialMessages(
        channel,
        user,
        settings,
        ticketType,
        issueDescription
      );

      return interaction.editReply(`Your ticket has been created: ${channel}`);
    } catch (error: any) {
      logger.error("Error creating ticket:", error);
      // Specific error handling for known DB errors
      if (error.code === "23503") {
        this.settingsManager.clearCache(interaction.guildId!);
        return interaction.editReply({
          content:
            "A configuration error occurred. The settings cache has been cleared. Please try creating a ticket again. If the issue persists, an administrator may need to run `/config set`.",
        });
      }
      return interaction.editReply(
        error.message ||
          "An unexpected error occurred while creating your ticket."
      );
    }
  }

  async close(interaction: ModalSubmitInteraction, reason: string) {
    if (!interaction.inGuild() || !interaction.channel || !interaction.guild) {
      return interaction.editReply(
        "This command can only be used in a ticket channel."
      );
    }

    const guild = interaction.guild;
    const channel = interaction.channel as TextChannel;

    try {
      const ticket = await this._validateTicketChannel(channel.id);
      const owner = await this.client.users.fetch(ticket.ownerId);
      const settings = await this.settingsManager.getSettings(guild.id);
      const sanitizedReason = sanitize(reason);

      const transcriptUrl = await generateTranscript(channel);

      if (settings?.logChannelId) {
        await this._sendLogMessage(
          guild,
          settings.logChannelId,
          ticket,
          owner,
          interaction.user,
          sanitizedReason,
          transcriptUrl
        );
      }

      await this.ticketRepository.closeTicket(channel.id, {
        closedById: interaction.user.id,
        closeReason: sanitizedReason,
        transcriptUrl: transcriptUrl || undefined,
      });

      await this._archiveTicketChannel(channel, owner, settings);

      await this._sendDMOnClose(
        guild,
        ticket,
        owner,
        interaction.user,
        sanitizedReason,
        transcriptUrl
      );

      return interaction.editReply("Ticket closed.");
    } catch (error: any) {
      logger.error(`Error closing ticket ${channel.id}:`, error);
      return interaction.editReply(
        error.message ||
          "An unexpected error occurred while closing the ticket."
      );
    }
  }

  public async findTicketByChannel(channelId: string) {
    return this.ticketRepository.findTicketByChannel(channelId);
  }

  private async _validateAndGetSettings(
    guildId: string
  ): Promise<GuildSettings> {
    const settings = await this.settingsManager.getSettings(guildId);
    if (!settings || !settings.ticketCategoryId || !settings.staffRoleId) {
      throw new Error("The ticket system has not been configured yet.");
    }
    return settings;
  }

  private async _checkForExistingTicket(
    guildId: string,
    userId: string
  ): Promise<void> {
    const existingTicket = await this.ticketRepository.findOpenTicketByOwner(
      guildId,
      userId
    );
    if (existingTicket) {
      throw new Error(
        `You already have an open ticket: <#${existingTicket.channelId}>`
      );
    }
  }

  private async _createTicketChannel(
    guild: Guild,
    user: User,
    settings: GuildSettings,
    newGuildTicketId: number
  ): Promise<TextChannel> {
    const permissionOverwrites: OverwriteResolvable[] = [
      {
        id: guild.id,
        deny: ["ViewChannel"],
      },
      {
        id: user.id,
        allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"],
      },
    ];

    if (settings.staffRoleId) {
      permissionOverwrites.push({
        id: settings.staffRoleId,
        allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"],
      });
    }

    try {
      const channel = await guild.channels.create({
        name: `ticket-${newGuildTicketId}`,
        type: ChannelType.GuildText,
        parent: settings.ticketCategoryId,
        permissionOverwrites,
      });
      return channel;
    } catch (error) {
      logger.error("Failed to create ticket channel:", error);
      throw new Error("Could not create the ticket channel.");
    }
  }

  private async _sendInitialMessages(
    channel: TextChannel,
    user: User,
    settings: GuildSettings,
    ticketType?: string,
    issueDescription?: string
  ) {
    const embed = new EmbedBuilder()
      .setAuthor({
        name: "New Support Ticket",
        iconURL: user.displayAvatarURL(),
      })
      .setDescription(
        `Welcome, <@${user.id}>! A staff member will be with you shortly.`
      )
      .addFields(
        { name: "Type", value: ticketType || "General" },
        {
          name: "Issue",
          value: issueDescription || "No issue description provided.",
        }
      )
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(TicketAction.CLOSE)
        .setLabel("Close Ticket")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(TicketAction.CLAIM)
        .setLabel("Claim Ticket")
        .setStyle(ButtonStyle.Success)
    );

    const mentionContent = `||<@${user.id}>${
      settings.staffRoleId ? `<@&${settings.staffRoleId}>` : ""
    }||`;

    try {
      await Promise.all([
        channel.send({ embeds: [embed], components: [row] }),
        channel.send({ content: mentionContent }),
      ]);
    } catch (error) {
      logger.error(`Failed to send initial messages to ${channel.id}:`, error);
      // Attempt to delete the channel if messages fail, to avoid orphaned channels
      await channel
        .delete()
        .catch((delErr) =>
          logger.error(`Failed to clean up channel ${channel.id}:`, delErr)
        );
      throw new Error("Could not send messages to the new ticket channel.");
    }
  }

  private async _validateTicketChannel(channelId: string): Promise<Ticket> {
    const ticket = await this.ticketRepository.findTicketByChannel(channelId);
    if (!ticket) {
      throw new Error("This is not a valid ticket channel.");
    }
    if (ticket.status === TicketStatus.CLOSED) {
      throw new Error("This ticket is already closed.");
    }
    return ticket;
  }

  private _createCloseEmbed(
    title: string,
    guild: Guild,
    ticket: Ticket,
    owner: User,
    closer: User,
    reason: string,
    transcriptUrl?: string | null
  ): EmbedBuilder {
    const openTime = Math.floor(new Date(ticket.createdAt).getTime() / 1000);
    const embed = new EmbedBuilder()
      .setTitle(title)
      .setColor(0x32a852)
      .setTimestamp()
      .addFields(
        {
          name: "<:id:1395852626360275166> Ticket ID",
          value: ticket.guildTicketId.toString(),
          inline: true,
        },
        {
          name: "<:open:1395852835266236547> Opened By",
          value: `<@${owner.id}>`,
          inline: true,
        },
        {
          name: "<:close:1395852886596128818> Closed By",
          value: `<@${closer.id}>`,
          inline: true,
        },
        {
          name: "<:opentime:1395852963079000106> Open Time",
          value: `<t:${openTime}:f>`,
          inline: true,
        },
        {
          name: "<:claim:1395853067357786202> Claimed By",
          value: ticket.claimedById
            ? `<@${ticket.claimedById}>`
            : "Not claimed",
          inline: true,
        },
        { name: "​", value: "‎", inline: true },
        {
          name: "<:reason:1395853176841834516> Reason",
          value: reason || "No reason specified",
          inline: false,
        }
      );

    if (title === "Ticket Closed") {
      embed.setAuthor({
        name: guild.name,
        iconURL: guild.iconURL() || undefined,
      });
    }

    return embed;
  }

  private async _sendLogMessage(
    guild: Guild,
    logChannelId: string,
    ticket: Ticket,
    owner: User,
    closer: User,
    reason: string,
    transcriptUrl: string | null
  ) {
    try {
      const logChannel = (await guild.channels.fetch(
        logChannelId
      )) as TextChannel;
      const embed = this._createCloseEmbed(
        "Ticket Closed",
        guild,
        ticket,
        owner,
        closer,
        reason,
        transcriptUrl
      );
      const components = [];
      if (transcriptUrl) {
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setLabel("View Transcript")
            .setStyle(ButtonStyle.Link)
            .setURL(transcriptUrl)
        );
        components.push(row);
      }
      const logMessage = await logChannel.send({ embeds: [embed], components });
      await this.db
        .updateTable("tickets")
        .set({ logMessageId: logMessage.id })
        .where("id", "=", ticket.id)
        .execute();
    } catch (error) {
      logger.error(
        `Failed to send log message for ticket ${ticket.id}:`,
        error
      );
    }
  }

  private async _archiveTicketChannel(
    channel: TextChannel,
    owner: User,
    settings: GuildSettings | null
  ) {
    try {
      await Promise.all([
        channel.permissionOverwrites.delete(owner.id).catch(() => {}),
        channel.permissionOverwrites
          .delete(channel.guild.roles.everyone.id)
          .catch(() => {}),
      ]);

      if (settings?.archiveCategoryId) {
        await channel.setParent(settings.archiveCategoryId, {
          lockPermissions: true,
        });
      }
    } catch (error) {
      logger.warn(`Failed to archive channel ${channel.id}.`, error);
    }
  }

  private async _sendDMOnClose(
    guild: Guild,
    ticket: Ticket,
    owner: User,
    closer: User,
    reason: string,
    transcriptUrl: string | null
  ) {
    try {
      const dmEmbed = this._createCloseEmbed(
        "Ticket Closed",
        guild,
        ticket,
        owner,
        closer,
        reason,
        transcriptUrl
      );
      const components = [];
      if (transcriptUrl) {
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setLabel("View Transcript")
            .setStyle(ButtonStyle.Link)
            .setURL(transcriptUrl)
        );
        components.push(row);
      }
      await owner.send({ embeds: [dmEmbed], components });
    } catch (error) {
      logger.warn(`Could not DM user ${owner.id}`, error);
    }
  }
}
