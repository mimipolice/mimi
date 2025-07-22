import {
  StringSelectMenuInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from "discord.js";
import { SelectMenu } from "../../interfaces/SelectMenu";
import { ticketDB } from "../../shared/database";

export default {
  name: "ai_prompt_select",
  execute: async (interaction: StringSelectMenuInteraction) => {
    const promptId = interaction.values[0];

    const prompt = await ticketDB
      .selectFrom("ai_prompts")
      .selectAll()
      .where("id", "=", parseInt(promptId, 10))
      .executeTakeFirst();

    if (!prompt) {
      await interaction.reply({
        content: "Could not find the selected prompt.",
        ephemeral: true,
      });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(`ai_continue_modal_0_${prompt.id}`)
      .setTitle(prompt.name);

    const messageInput = new TextInputBuilder()
      .setCustomId("message")
      .setLabel("Your Message")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(
      messageInput
    );
    modal.addComponents(row);

    await interaction.showModal(modal);
  },
} as SelectMenu;
