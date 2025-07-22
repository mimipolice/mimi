import {
  ModalBuilder,
  TextInputBuilder,
  ActionRowBuilder,
  TextInputStyle,
  ModalSubmitInteraction,
} from "discord.js";
import { Modal } from "../../interfaces/Modal";
import { ticketDB } from "../../shared/database";

const modal: Modal = {
  name: "ai_prompt_create",
  execute: async (interaction: ModalSubmitInteraction) => {
    const name = interaction.fields.getTextInputValue("prompt_name");
    const prompt = interaction.fields.getTextInputValue("prompt_content");
    const userId = interaction.user.id;

    try {
      await ticketDB
        .insertInto("ai_prompts")
        .values({
          user_id: userId,
          name,
          prompt,
          created_at: new Date().toISOString(),
        })
        .execute();

      await interaction.reply({
        content: `Prompt "${name}" created successfully.`,
        ephemeral: true,
      });
    } catch (error) {
      if (error instanceof Error) {
        await interaction.reply({
          content: `Error creating prompt: ${error.message}`,
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: "An unknown error occurred while creating the prompt.",
          ephemeral: true,
        });
      }
    }
  },
};

export const createPromptModal = () => {
  return new ModalBuilder()
    .setCustomId("ai_prompt_create")
    .setTitle("Create AI Prompt")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("prompt_name")
          .setLabel("Prompt Name")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("prompt_content")
          .setLabel("Prompt Content")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
      )
    );
};

export default modal;
