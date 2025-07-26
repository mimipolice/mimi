import {
  ActionRowBuilder,
  ButtonInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { Button } from "../../interfaces/Button";

const button: Button = {
  name: "appeal",
  execute: async (interaction: ButtonInteraction) => {
    const [, userId, guildId] = interaction.customId.split(":");
    const messageId = interaction.message.id;

    const modal = new ModalBuilder()
      .setCustomId(`anti_spam_appeal_modal:${userId}:${guildId}:${messageId}`)
      .setTitle("Appeal Timeout");

    const reasonInput = new TextInputBuilder()
      .setCustomId("appealReason")
      .setLabel("Reason for Appeal")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(
      reasonInput
    );

    modal.addComponents(actionRow);

    await interaction.showModal(modal);
  },
};

export default button;
