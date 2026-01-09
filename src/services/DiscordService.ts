import {
  Client,
  Guild,
  User,
  TextChannel,
  OverwriteResolvable,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
} from "discord.js";
import { MessageFlags } from "discord-api-types/v10";
import logger from "../utils/logger";
import { GuildSettings } from "./SettingsManager";
import { Ticket } from "../repositories/ticket.repository";
import { TicketAction } from "../types/ticket";
import {
  logChannelPermissions,
  safeDeletePermissionOverwrite,
  safeEditPermissionOverwrite,
} from "../utils/ticketDebug";
import {
  DISCORD_BLURPLE,
  DISCORD_GREEN,
  DISCORD_DEFAULT_AVATAR,
  TICKET_LOG_BANNER_URL,
  EMOJIS,
} from "../constants";

import { LocalizationManager } from "./LocalizationManager";
import { mapLocale } from "../utils/localeHelper";

export class DiscordService {
  private client: Client;
  private localizationManager: LocalizationManager;

  constructor(client: Client) {
    this.client = client;
    this.localizationManager = new LocalizationManager();
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

  static buildTicketContainer(
    user: User,
    ticketType?: string,
    issueDescription?: string,
    claimedBy?: string
  ): ContainerBuilder {
    let truncatedDescription = issueDescription || "No issue description provided.";
    if (truncatedDescription.length > 1024) {
      logger.warn(
        `Issue description truncated from ${truncatedDescription.length} to 1024 chars for user ${user.id}`
      );
      truncatedDescription = truncatedDescription.substring(0, 1021) + "...";
    }

    const container = new ContainerBuilder();
    container.setAccentColor(DISCORD_BLURPLE);

    // Header section with user avatar
    container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          (text) => text.setContent("# New Support Ticket"),
          (text) => text.setContent(`Welcome, <@${user.id}>! A staff member will be with you shortly.`)
        )
        .setThumbnailAccessory(
          new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true }))
        )
    );

    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    );

    // Ticket details
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**Type**\n${ticketType || "General"}`
      )
    );

    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    );

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**Issue**\n${truncatedDescription}`
      )
    );

    // Show claimed by if provided
    if (claimedBy) {
      container.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
      );
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `**Claimed by**\n<@${claimedBy}>`
        )
      );
    }

    return container;
  }

  static buildTicketActionRow(
    claimed: boolean = false,
    claimLabel: string = "Claim Ticket",
    closeLabel: string = "Close Ticket"
  ): ActionRowBuilder<ButtonBuilder> {
    // Original order: Close button first, then Claim button
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(TicketAction.CLOSE)
        .setLabel(closeLabel)
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(TicketAction.CLAIM)
        .setLabel(claimLabel)
        .setStyle(ButtonStyle.Success)
        .setDisabled(claimed)
    );
  }

  async sendInitialMessages(
    channel: TextChannel,
    user: User,
    settings: GuildSettings,
    ticketType?: string,
    issueDescription?: string
  ) {
    const container = DiscordService.buildTicketContainer(user, ticketType, issueDescription);
    const row = DiscordService.buildTicketActionRow(false);

    const mentionContent = `||<@${user.id}>${settings.staffRoleId ? `<@&${settings.staffRoleId}>` : ""
      }||`;

    try {
      await Promise.all([
        channel.send({
          components: [container, row],
          flags: MessageFlags.IsComponentsV2,
        }),
        channel.send({ content: mentionContent }),
      ]);
    } catch (error) {
      logger.error(`Failed to send initial messages to ${channel.id}:`, error);
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
    const mappedLocale = mapLocale(guild.preferredLocale);
    try {
      const logChannel = (await guild.channels.fetch(
        logChannelId
      )) as TextChannel;
      const container = this.generateTicketLog(
        guild,
        ticket,
        owner,
        closer,
        reason,
        transcriptUrl,
        mappedLocale
      );

      const components: (ContainerBuilder | ActionRowBuilder<ButtonBuilder>)[] = [container];

      // Add ticket history button
      const historyButtonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`ticket_history:${ticket.id}`)
          .setLabel(
            this.localizationManager.get(
              "global.log.viewHistory",
              mappedLocale
            ) ?? "View User's Ticket History"
          )
          .setStyle(ButtonStyle.Secondary)
          .setEmoji(EMOJIS.ID.toComponentEmoji())
      );
      components.push(historyButtonRow);

      const logMessage = await logChannel.send({
        components,
        flags: MessageFlags.IsComponentsV2,
      });
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
      logChannelPermissions(channel, "Before Archive");

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

      await safeDeletePermissionOverwrite(
        channel,
        owner.id,
        `Owner ${owner.username}`
      );

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

      if (settings?.archiveCategoryId) {
        try {
          const archiveCategory = await channel.guild.channels.fetch(
            settings.archiveCategoryId
          );

          if (!archiveCategory) {
            logger.warn(
              `Archive category ${settings.archiveCategoryId} not found for guild ${channel.guild.id}, skipping move`
            );
          } else {
            await channel.setParent(settings.archiveCategoryId, {
              lockPermissions: false,
            });
            logger.info(
              `Successfully moved channel ${channel.id} to archive category ${settings.archiveCategoryId}`
            );
          }
        } catch (moveError: any) {
          logger.warn(
            `Failed to move channel ${channel.id} to archive category (possibly full - 50 channel limit), but channel is secured:`,
            moveError.message || moveError
          );
        }
      } else {
        logger.info(`No archive category configured for guild ${channel.guild.id}`);
      }

      logChannelPermissions(channel, "After Archive");
      logger.info(`Successfully archived and secured channel ${channel.id}`);
    } catch (error) {
      logger.error(`Critical error archiving channel ${channel.id}:`, error);
      logChannelPermissions(channel, "After Archive Error");
      throw new Error(
        `Failed to archive ticket channel: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  async deleteTicketChannel(channel: TextChannel, owner?: User): Promise<void> {
    try {
      logChannelPermissions(channel, "Before Delete");
      const channelId = channel.id;
      const channelName = channel.name;
      const guildId = channel.guild.id;

      await channel.delete("Ticket closed - deleting ticket channel");

      const ownerInfo = owner ? ` (owner: ${owner.username}/${owner.id})` : "";
      logger.info(`[AUDIT] Deleted ticket channel #${channelName} (${channelId}) in guild ${guildId}${ownerInfo}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      // 檢查是否為權限相關錯誤
      const isPermissionError = errorMessage.includes("Missing Permissions") ||
        errorMessage.includes("Missing Access") ||
        (error instanceof Error && "code" in error && (error as any).code === 50013);

      if (isPermissionError) {
        logger.error(`[PERMISSION] Bot lacks permission to delete channel ${channel.id}. Ensure bot has ManageChannels permission.`);
      } else {
        logger.error(`Critical error deleting channel ${channel.id}:`, error);
      }
      throw new Error(`Failed to delete ticket channel: ${errorMessage}`);
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
      const container = this.generateTicketLog(
        guild,
        ticket,
        owner,
        closer,
        reason,
        transcriptUrl
      );

      const components: (ContainerBuilder | ActionRowBuilder<ButtonBuilder>)[] = [container];
      if (transcriptUrl) {
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setLabel("View Transcript")
            .setStyle(ButtonStyle.Link)
            .setURL(transcriptUrl)
        );
        components.push(row);
      }

      await owner.send({
        components,
        flags: MessageFlags.IsComponentsV2,
      });
    } catch (error) {
      logger.warn(`Could not DM user ${owner.id}`, error);
    }
  }

  async fetchUser(userId: string): Promise<User> {
    return this.client.users.fetch(userId);
  }

  public generateTicketLog(
    guild: Guild,
    ticket: Ticket,
    owner: User,
    closer: User,
    reason: string,
    transcriptUrl?: string | null,
    locale: string = "en-US"
  ): ContainerBuilder {
    const t = (key: string) =>
      this.localizationManager.get(`global.log.${key}`, locale) ?? key;

    const openTime = Math.floor(new Date(ticket.createdAt).getTime() / 1000);

    const container = new ContainerBuilder();
    container.setAccentColor(DISCORD_GREEN);

    // Add banner at the top to set container width
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder().setURL(TICKET_LOG_BANNER_URL)
      )
    );

    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    );

    // Header with guild info
    container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          (text) => text.setContent(`# ${t("title")}`),
          (text) => text.setContent(`-# ${guild.name}`)
        )
        .setThumbnailAccessory(
          new ThumbnailBuilder().setURL(guild.iconURL() || DISCORD_DEFAULT_AVATAR)
        )
    );

    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    );

    // Ticket info with emojis
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${EMOJIS.ID} **${t("ticketId")}**\n#${ticket.guildTicketId}\n\n` +
        `${EMOJIS.OPEN} **${t("openedBy")}**\n<@${owner.id}>\n\n` +
        `${EMOJIS.OPENTIME} **${t("openTime")}**\n<t:${openTime}:f>`
      )
    );

    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    );

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${EMOJIS.CLOSE} **${t("closedBy")}**\n<@${closer.id}>\n\n` +
        `${EMOJIS.CLAIM} **${t("claimedBy")}**\n${ticket.claimedById
          ? `<@${ticket.claimedById}>`
          : t("notClaimed")
        }`
      )
    );

    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    );

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${EMOJIS.REASON} **${t("reason")}**\n${reason || t("noReason")
        }`
      )
    );

    // Add transcript button inside container if available
    if (transcriptUrl) {
      container.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
      );

      container.addActionRowComponents(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setLabel(t("viewTranscript"))
            .setStyle(ButtonStyle.Link)
            .setURL(transcriptUrl)
        )
      );
    }

    return container;
  }
}
