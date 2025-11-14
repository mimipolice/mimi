import {
  ActionRowBuilder,
  ButtonInteraction,
  Client,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { TicketManager } from "../../services/TicketManager";
import { SettingsManager } from "../../services/SettingsManager";

export default {
  name: "create_ticket",
  execute: async function (
    interaction: ButtonInteraction,
    _client: Client,
    _settingsManager: SettingsManager,
    ticketManager: TicketManager
  ) {
    if (!ticketManager) return;

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
