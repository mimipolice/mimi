import {
  ActionRowBuilder,
  ModalBuilder,
  StringSelectMenuInteraction,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
} from "discord.js";
import logger from "../../utils/logger";
import { SelectMenu } from "../../interfaces/SelectMenu";
import { getInteractionLocale } from "../../utils/localeHelper";

const selectMenu: SelectMenu = {
  name: "create_ticket_menu",
  execute: async function (interaction, services, _databases) {
    const locale = getInteractionLocale(interaction);
    const { localizationManager } = services;

    const t = (key: string) =>
      localizationManager.get(`global.ticket.${key}`, locale) ?? key;

    try {
      const ticketType = interaction.values[0].split(":")[1];

      const modal = new ModalBuilder()
        .setCustomId(`create_ticket_modal:${ticketType || ""}`)
        .setTitle(t("modalTitle"));

      const issueDescription = new TextInputBuilder()
        .setCustomId("ticket_issue_description")
        .setLabel(t("describeIssue"))
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMinLength(10)
        .setMaxLength(1024); // Discord embed field limit

      const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(
        issueDescription
      );

      modal.addComponents(actionRow);

      await interaction.showModal(modal);
    } catch (error) {
      logger.error("Error in createTicketMenu:", {
        error,
        userId: interaction.user.id,
        guildId: interaction.guildId,
      });

      // Try to inform the user
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: t("formError"),
            flags: MessageFlags.Ephemeral,
          });
        }
      } catch (replyError) {
        logger.error("Failed to send error message in createTicketMenu:", replyError);
      }
    }
  }
};

export default selectMenu;
