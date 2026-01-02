import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  Locale,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ComponentType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { Command, Databases, Services } from "../../../interfaces/Command";
import { MessageFlags } from "discord-api-types/v10";
import { getTicketTypes, TicketRepository } from "../../../repositories/ticket.repository";
import { mimiDLCDb } from "../../../shared/database";
import logger from "../../../utils/logger";
import { getInteractionLocale } from "../../../utils/localeHelper";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("create-ticket")
    .setDescription("Create a support ticket")
    .setDescriptionLocalizations({
      [Locale.ChineseTW]: "創建客服單",
    }),
  async execute(
    interaction: ChatInputCommandInteraction,
    client: Client,
    services: Services,
    _databases: Databases
  ) {
    const locale = getInteractionLocale(interaction);
    const { localizationManager } = services;

    // Helper function to get ticket i18n strings
    const t = (key: string, options?: Record<string, string | number>) =>
      localizationManager.get(`global.ticket.${key}`, locale, options) ?? key;

    try {
      if (!interaction.guildId) {
        await interaction.reply({
          content: t("serverOnly"),
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // Check if user already has an open ticket
      const ticketRepo = new TicketRepository(mimiDLCDb);
      const existingTicket = await ticketRepo.findOpenTicketByOwner(
        interaction.guildId,
        interaction.user.id
      );

      if (existingTicket) {
        await interaction.reply({
          content: t("alreadyOpen", { channelId: existingTicket.channelId }),
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // Get available ticket types for this guild
      const ticketTypes = await getTicketTypes(interaction.guildId);

      if (ticketTypes.length === 0) {
        await interaction.reply({
          content: t("noTypes"),
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // If only one ticket type, show modal directly
      if (ticketTypes.length === 1) {
        const ticketType = ticketTypes[0];
        const modal = new ModalBuilder()
          .setCustomId(`create_ticket_modal:${ticketType.type_id}`)
          .setTitle(t("modalTitle"));

        const issueDescription = new TextInputBuilder()
          .setCustomId("ticket_issue_description")
          .setLabel(t("describeIssue"))
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMinLength(10)
          .setMaxLength(1024);

        const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(
          issueDescription
        );

        modal.addComponents(actionRow);
        await interaction.showModal(modal);
        return;
      }

      // Multiple ticket types - show select menu
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("ticket_type_select")
        .setPlaceholder(t("selectPlaceholder"))
        .addOptions(
          ticketTypes.map((type) => {
            const option = new StringSelectMenuOptionBuilder()
              .setLabel(type.label)
              .setValue(`ticket_type:${type.type_id}`);

            if (type.emoji) {
              option.setEmoji(type.emoji);
            }

            return option;
          })
        );

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        selectMenu
      );

      const response = await interaction.reply({
        content: t("selectType"),
        components: [row],
        flags: MessageFlags.Ephemeral,
      });

      // Wait for selection
      try {
        const selectInteraction = await response.awaitMessageComponent({
          componentType: ComponentType.StringSelect,
          time: 60_000, // 60 seconds
        });

        const selectedType = selectInteraction.values[0].split(":")[1];

        // Show modal
        const modal = new ModalBuilder()
          .setCustomId(`create_ticket_modal:${selectedType}`)
          .setTitle(t("modalTitle"));

        const issueDescription = new TextInputBuilder()
          .setCustomId("ticket_issue_description")
          .setLabel(t("describeIssue"))
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMinLength(10)
          .setMaxLength(1024);

        const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(
          issueDescription
        );

        modal.addComponents(actionRow);
        await selectInteraction.showModal(modal);
      } catch (error) {
        // Timeout or error
        await interaction.editReply({
          content: t("timeout"),
          components: [],
        });
      }
    } catch (error) {
      logger.error("[Ticket Command] Error:", error);

      const replyContent = t("createError");

      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ content: replyContent });
      } else {
        await interaction.reply({
          content: replyContent,
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  },
};
