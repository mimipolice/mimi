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
  StringSelectMenuBuilder,
} from "discord.js";
import { MessageFlags } from "discord-api-types/v10";
import logger from "../utils/logger";
import { GuildSettings } from "./SettingsManager";
import { Ticket } from "../repositories/ticket.repository";
import { TicketAction, TicketLogMenuAction, TicketLogMenuOptions } from "../types/ticket";
import {
  logChannelPermissions,
  safeDeletePermissionOverwrite,
  safeEditPermissionOverwrite,
} from "../utils/ticketDebug";

// Discord brand colors
const DISCORD_BLURPLE = 0x5865f2;
const DISCORD_GREEN = 0x57f287;

// Discord default avatar URL (used when guild has no icon)
const DISCORD_DEFAULT_AVATAR = "https://cdn.discordapp.com/embed/avatars/0.png";

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

    const mentionContent = `||<@${user.id}>${
      settings.staffRoleId ? `<@&${settings.staffRoleId}>` : ""
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
    try {
      const logChannel = (await guild.channels.fetch(
        logChannelId
      )) as TextChannel;
      const container = this._createCloseContainer(
        guild,
        ticket,
        owner,
        closer,
        reason,
        transcriptUrl
      );

      const components: (ContainerBuilder | ActionRowBuilder<ButtonBuilder> | ActionRowBuilder<StringSelectMenuBuilder>)[] = [container];

      // Add transcript button if available
      if (transcriptUrl) {
        const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setLabel("View Transcript")
            .setStyle(ButtonStyle.Link)
            .setURL(transcriptUrl)
        );
        components.push(buttonRow);
      }

      // Add ticket management select menu (uses shared option values)
      const selectMenuRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`${TicketLogMenuAction.MAIN}:${ticket.id}`)
          .setPlaceholder("Select action...")
          .addOptions(
            { label: "Ticket History", description: "View this user's ticket history", ...TicketLogMenuOptions.HISTORY },
            { label: "Mark Status", description: "Mark the resolution status", ...TicketLogMenuOptions.STATUS },
            { label: "Category", description: "Set a category for this ticket", ...TicketLogMenuOptions.CATEGORY },
            { label: "Rating", description: "Rate the handling quality", ...TicketLogMenuOptions.RATING }
          )
      );
      components.push(selectMenuRow);

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
      const container = this._createCloseContainer(
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

  private _createCloseContainer(
    guild: Guild,
    ticket: Ticket,
    owner: User,
    closer: User,
    reason: string,
    transcriptUrl?: string | null
  ): ContainerBuilder {
    const openTime = Math.floor(new Date(ticket.createdAt).getTime() / 1000);

    const container = new ContainerBuilder();
    container.setAccentColor(DISCORD_GREEN);

    // Header with guild info
    container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          (text) => text.setContent("# Ticket Closed"),
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
        `<:id:1395852626360275166> **Ticket ID**\n#${ticket.guildTicketId}\n\n` +
        `<:open:1395852835266236547> **Opened By**\n<@${owner.id}>\n\n` +
        `<:opentime:1395852963079000106> **Open Time**\n<t:${openTime}:f>`
      )
    );

    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    );

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `<:close:1395852886596128818> **Closed By**\n<@${closer.id}>\n\n` +
        `<:claim:1395853067357786202> **Claimed By**\n${ticket.claimedById ? `<@${ticket.claimedById}>` : "Not claimed"}`
      )
    );

    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    );

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `<:reason:1395853176841834516> **Reason**\n${reason || "No reason specified"}`
      )
    );

    return container;
  }
}
