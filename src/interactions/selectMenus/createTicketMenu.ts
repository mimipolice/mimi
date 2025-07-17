import {
  ActionRowBuilder,
  ModalBuilder,
  StringSelectMenuInteraction,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

export const name = "create_ticket_menu";

export async function execute(interaction: StringSelectMenuInteraction) {
  const ticketType = interaction.values[0].split(":")[1];

  const modal = new ModalBuilder()
    .setCustomId(`create_ticket_modal:${ticketType || ""}`)
    .setTitle("Create a New Ticket");

  const issueDescription = new TextInputBuilder()
    .setCustomId("ticket_issue_description")
    .setLabel("Please describe your issue")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(10);

  const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(
    issueDescription
  );

  modal.addComponents(actionRow);

  await interaction.showModal(modal);
}
