import {
  ButtonInteraction,
  Client,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  MessageFlags,
  PermissionFlagsBits,
  GuildMember,
} from "discord.js";
import { Button } from "../../interfaces/Button";
import { Databases, Services } from "../../interfaces/Command";
import { TicketRepository } from "../../repositories/ticket.repository";
import { getInteractionLocale } from "../../utils/localeHelper";
import logger from "../../utils/logger";
import { TicketLogMenuAction } from "../../types/ticket";
import { EMOJIS } from "../../constants";

/**
 * Button handler for viewing a user's ticket history from the log channel.
 * Shows a select menu with the user's past tickets.
 *
 * customId format: ticket_history:<ticket_id>
 */
const button: Button = {
  name: /^ticket_history:/,
  execute: async function (
    interaction: ButtonInteraction,
    _client: Client,
    services: Services,
    databases: Databases
  ) {
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

      // Parse ticket ID from customId
      const [, ticketIdStr] = interaction.customId.split(":");
      const ticketId = parseInt(ticketIdStr, 10);

      if (isNaN(ticketId)) {
        logger.warn(`Invalid ticketId in ticket_history button: ${interaction.customId}`);
        await interaction.reply({
          content: t("ticketNotFound"),
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const ticketRepo = new TicketRepository(ticketDb);

      // Get the current ticket to find the owner
      const ticket = await ticketRepo.findTicketById(ticketId);
      if (!ticket) {
        await interaction.reply({
          content: t("ticketNotFound"),
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // Fetch user's ticket history
      const history = await ticketRepo.findUserTicketHistory(
        ticket.guildId,
        ticket.ownerId,
        25
      );

      if (history.length === 0) {
        await interaction.reply({
          content: t("noHistory"),
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // Build history select menu options
      const options: StringSelectMenuOptionBuilder[] = [];

      for (const historyTicket of history) {
        const closedDate = historyTicket.closedAt
          ? new Date(historyTicket.closedAt).toLocaleDateString()
          : t("unknown");
        const reason = historyTicket.closeReason
          ? historyTicket.closeReason.substring(0, 50)
          : t("noReason");

        options.push(
          new StringSelectMenuOptionBuilder()
            .setLabel(`#${historyTicket.guildTicketId} - ${closedDate}`)
            .setDescription(reason)
            .setValue(historyTicket.id.toString())
        );
      }

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`${TicketLogMenuAction.HISTORY}:${ticketId}`)
        .setPlaceholder(t("historyPlaceholder"))
        .addOptions(options);

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

      await interaction.reply({
        content: `${EMOJIS.ID} **${t("historyLabel")}** - <@${ticket.ownerId}>`,
        components: [row],
        flags: MessageFlags.Ephemeral,
      });

    } catch (error) {
      logger.error("Error in ticketHistory button:", {
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
        logger.error("Failed to send error message in ticketHistory button:", replyError);
      }
    }
  },
};

export default button;
