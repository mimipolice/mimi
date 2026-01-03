import {
  MessageFlags,
  PermissionFlagsBits,
  GuildMember,
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} from "discord.js";
import logger from "../../utils/logger";
import { SelectMenu } from "../../interfaces/SelectMenu";
import { getInteractionLocale } from "../../utils/localeHelper";
import { TicketRepository } from "../../repositories/ticket.repository";
import { findLocalTranscript } from "../../utils/transcript";
import { DISCORD_BLURPLE, DISCORD_DEFAULT_AVATAR, EMOJIS } from "../../constants";

/**
 * Ticket Log Menu - Select menu handler for viewing ticket history details
 *
 * When a user selects a ticket from the history dropdown (triggered by the
 * "View Ticket History" button), this handler shows the ticket details
 * including transcript links using Components V2 for a polished look.
 *
 * customId format: ticket_log_menu:history:<ticket_id>
 */
const selectMenu: SelectMenu = {
  name: /^ticket_log_menu:history:/,
  execute: async function (interaction, services, databases) {
    const locale = getInteractionLocale(interaction);
    const { localizationManager, settingsManager } = services;
    const { ticketDb } = databases;

    const t = (key: string) =>
      localizationManager.get(`global.ticketLogMenu.${key}`, locale) ?? key;

    try {
      // Permission check: User must have staff role or ManageGuild permission
      const member = interaction.member;
      if (!member || !interaction.guildId) {
        await interaction.reply({
          content: t("noPermission"),
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // Check if user has ManageGuild permission (admin) or staff role
      const settings = await settingsManager.getSettings(interaction.guildId);
      const hasAdminPermission = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
      const hasStaffRole = settings?.staffRoleId &&
        member instanceof GuildMember &&
        member.roles.cache.has(settings.staffRoleId);

      if (!hasAdminPermission && !hasStaffRole) {
        await interaction.reply({
          content: t("noPermission"),
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const selectedValue = interaction.values[0];
      const selectedTicketId = parseInt(selectedValue, 10);

      // Validate selectedTicketId is a valid number
      if (isNaN(selectedTicketId)) {
        logger.warn(`Invalid selectedTicketId in history select: ${selectedValue}`);
        await interaction.reply({
          content: t("ticketNotFound"),
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const ticketRepo = new TicketRepository(ticketDb);
      const ticket = await ticketRepo.findTicketById(selectedTicketId);

      if (!ticket) {
        await interaction.reply({
          content: t("ticketNotFound"),
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // Fetch ticket owner for display
      let ownerUser;
      try {
        ownerUser = await interaction.client.users.fetch(ticket.ownerId);
      } catch (fetchError) {
        logger.debug(`Could not fetch user ${ticket.ownerId} for ticket history display`, fetchError);
        ownerUser = null;
      }

      const closedAt = ticket.closedAt
        ? `<t:${Math.floor(new Date(ticket.closedAt).getTime() / 1000)}:f>`
        : t("unknown");

      const createdAt = ticket.createdAt
        ? `<t:${Math.floor(new Date(ticket.createdAt).getTime() / 1000)}:f>`
        : t("unknown");

      // Build Components V2 Container for ticket details
      const container = new ContainerBuilder();
      container.setAccentColor(DISCORD_BLURPLE);

      // Header with ticket ID and owner avatar
      container.addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            (text) => text.setContent(`# ${t("historyDetail")}`),
            (text) => text.setContent(`-# Ticket #${ticket.guildTicketId}`)
          )
          .setThumbnailAccessory(
            new ThumbnailBuilder().setURL(
              ownerUser?.displayAvatarURL({ forceStatic: true }) ||
              DISCORD_DEFAULT_AVATAR
            )
          )
      );

      container.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
      );

      // Ticket info
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `${EMOJIS.OPEN} **${t("owner")}**\n<@${ticket.ownerId}>\n\n` +
          `${EMOJIS.OPENTIME} **${t("createdAt")}**\n${createdAt}\n\n` +
          `${EMOJIS.CLOSE} **${t("closedAt")}**\n${closedAt}`
        )
      );

      container.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
      );

      // Claimed by and reason
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `${EMOJIS.CLAIM} **${t("claimedBy")}**\n${ticket.claimedById ? `<@${ticket.claimedById}>` : t("notClaimed")}\n\n` +
          `${EMOJIS.REASON} **${t("reason")}**\n${ticket.closeReason || t("noReason")}`
        )
      );

      // Build components array
      const components: (ContainerBuilder | ActionRowBuilder<ButtonBuilder>)[] = [container];

      // Try to find transcript URL - use stored URL first, fallback to local search
      let transcriptUrl = ticket.transcriptUrl;
      const localTranscript = await findLocalTranscript(ticket.channelId);

      // Add transcript button(s) if available
      if (transcriptUrl || localTranscript) {
        const buttonRow = new ActionRowBuilder<ButtonBuilder>();

        if (transcriptUrl) {
          buttonRow.addComponents(
            new ButtonBuilder()
              .setLabel(t("viewTranscript"))
              .setStyle(ButtonStyle.Link)
              .setURL(transcriptUrl)
          );
        }

        // Add local transcript as secondary option if different from main URL
        if (localTranscript && localTranscript !== transcriptUrl) {
          buttonRow.addComponents(
            new ButtonBuilder()
              .setLabel(t("viewTranscriptLocal"))
              .setStyle(ButtonStyle.Link)
              .setURL(localTranscript)
          );
        } else if (localTranscript && !transcriptUrl) {
          // Only local transcript available
          buttonRow.addComponents(
            new ButtonBuilder()
              .setLabel(t("viewTranscript"))
              .setStyle(ButtonStyle.Link)
              .setURL(localTranscript)
          );
        }

        components.push(buttonRow);
      }

      await interaction.reply({
        components,
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });

    } catch (error) {
      logger.error("Error in ticketLogMenu:", {
        error,
        userId: interaction.user.id,
        guildId: interaction.guildId,
        customId: interaction.customId,
      });

      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: t("error"),
            flags: MessageFlags.Ephemeral,
          });
        }
      } catch (replyError) {
        logger.error("Failed to send error message in ticketLogMenu:", replyError);
      }
    }
  },
};

export default selectMenu;
