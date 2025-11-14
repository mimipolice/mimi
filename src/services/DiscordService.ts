import {
  Client,
  Guild,
  User,
  TextChannel,
  OverwriteResolvable,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import logger from "../utils/logger";
import { GuildSettings } from "./SettingsManager";
import { Ticket } from "../repositories/ticket.repository";
import { TicketAction } from "../types/ticket";
import {
  logChannelPermissions,
  safeDeletePermissionOverwrite,
  safeEditPermissionOverwrite,
} from "../utils/ticketDebug";

export class DiscordService {
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  async createTicketChannel(
    guild: Guild,
    user: User,
    settings: GuildSettings,
    ticketId: number
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
        name: `ticket-${user.username}`,
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

  async sendInitialMessages(
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

  async sendLogMessage(
    guild: Guild,
    logChannelId: string,
    ticket: Ticket,
    owner: User,
    closer: User,
    reason: string,
    transcriptUrl: string | null
  ): Promise<string | null> {
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
      return logMessage.id;
    } catch (error) {
      logger.error(
        `Failed to send log message for ticket ${ticket.id}:`,
        error
      );
      return null;
    }
  }

  async archiveTicketChannel(
    channel: TextChannel,
    owner: User,
    settings: GuildSettings | null
  ) {
    try {
      // Log initial state for debugging
      logChannelPermissions(channel, "Before Archive");

      // CRITICAL SECURITY STEP 1: ALWAYS remove @everyone view permission FIRST
      // This must succeed before anything else to prevent ticket content leaks
      logger.info(`[SECURITY] Removing @everyone view permission for channel ${channel.id}`);
      const everyoneSuccess = await safeEditPermissionOverwrite(
        channel,
        channel.guild.roles.everyone.id,
        "@everyone",
        { ViewChannel: false }
      );

      if (!everyoneSuccess) {
        logger.error(
          `[SECURITY CRITICAL] Failed to remove @everyone view permission for channel ${channel.id}`
        );
        throw new Error("Failed to secure channel - @everyone permission removal failed");
      }
      logger.info(`[SECURITY] Successfully secured channel ${channel.id} from @everyone`);

      // Step 2: Remove owner's access
      await safeDeletePermissionOverwrite(
        channel,
        owner.id,
        `Owner ${owner.username}`
      );

      // Step 3: Ensure staff can view (read-only)
      if (settings?.staffRoleId) {
        await safeEditPermissionOverwrite(
          channel,
          settings.staffRoleId,
          "Staff Role",
          {
            ViewChannel: true,
            SendMessages: false,
            ReadMessageHistory: true,
          }
        );
      }

      // Step 4: Try to move to archive category (optional, can fail)
      if (settings?.archiveCategoryId) {
        try {
          // Verify archive category exists
          const archiveCategory = await channel.guild.channels.fetch(
            settings.archiveCategoryId
          );
          
          if (!archiveCategory) {
            logger.warn(
              `Archive category ${settings.archiveCategoryId} not found for guild ${channel.guild.id}, skipping move`
            );
          } else {
            // Move channel WITHOUT locking permissions (we already set them)
            await channel.setParent(settings.archiveCategoryId, {
              lockPermissions: false,
            });
            logger.info(
              `Successfully moved channel ${channel.id} to archive category ${settings.archiveCategoryId}`
            );
          }
        } catch (moveError: any) {
          // Moving to archive category failed, but channel is already secured
          logger.warn(
            `Failed to move channel ${channel.id} to archive category (possibly full - 50 channel limit), but channel is secured:`,
            moveError.message || moveError
          );
          // Don't throw - the important part (securing permissions) already succeeded
        }
      } else {
        logger.info(`No archive category configured for guild ${channel.guild.id}`);
      }

      // Log final state for debugging
      logChannelPermissions(channel, "After Archive");
      logger.info(`Successfully archived and secured channel ${channel.id}`);
    } catch (error) {
      logger.error(`Critical error archiving channel ${channel.id}:`, error);
      logChannelPermissions(channel, "After Archive Error");
      // Don't silently fail - this is important for debugging
      throw new Error(
        `Failed to archive ticket channel: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  async addUserToChannel(channel: TextChannel, user: User): Promise<void> {
    await channel.permissionOverwrites.edit(user.id, {
      ViewChannel: true,
    });
  }

  async removeUserFromChannel(channel: TextChannel, user: User): Promise<void> {
    const success = await safeDeletePermissionOverwrite(
      channel,
      user.id,
      `User ${user.username}`
    );
    if (!success) {
      throw new Error(`Failed to remove user ${user.username} from channel`);
    }
  }

  async sendDMOnClose(
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

  async fetchUser(userId: string): Promise<User> {
    return this.client.users.fetch(userId);
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
}
