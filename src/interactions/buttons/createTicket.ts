import {
  ActionRowBuilder,
  ButtonInteraction,
  Client,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { Services } from "../../interfaces/Command";
import logger from "../../utils/logger";

export default {
  name: "create_ticket",
  execute: async function (
    interaction: ButtonInteraction,
    _client: Client,
    services: Services
  ) {
    if (!services.ticketManager) {
      logger.error("TicketManager service not available in createTicket button");
      return;
    }

    const [_, ticketType] = interaction.customId.split(":");

    const modal = new ModalBuilder()
      .setCustomId(`create_ticket_modal:${ticketType || ""}`)
      .setTitle("Create a New Ticket");

    const issueDescription = new TextInputBuilder()
      .setCustomId("ticket_issue_description")
      .setLabel("Please describe your issue")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMinLength(10)
      .setMaxLength(1024);

    const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(
      issueDescription
    );

    modal.addComponents(actionRow);

    await interaction.showModal(modal);
  }
};
