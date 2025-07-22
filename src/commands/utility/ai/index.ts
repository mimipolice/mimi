import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} from "discord.js";
import { Command } from "../../../interfaces/Command";
import { ticketDB, ticketPool } from "../../../shared/database";
import { AIService } from "../../../services/AIService";
import { createPromptModal } from "../../../interactions/modals/aiPromptCreateModal";
import { BusinessError } from "../../../errors";
import { createAIMessage } from "../../../utils/aiMessageGenerator";
import * as queries from "../../../shared/database/queries";

const apiKey = process.env.OPENAI_API_KEY;
const apiEndpoint = process.env.OPENAI_API_ENDPOINT;

let aiService: AIService | null = null;
if (apiKey && apiEndpoint) {
  aiService = new AIService(apiKey, apiEndpoint, ticketPool);
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("ai")
    .setDescription("Chat with AI or manage prompts.")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("chat")
        .setDescription("Chat with the AI.")
        .addBooleanOption((option) =>
          option
            .setName("clear")
            .setDescription("Clear the conversation history.")
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("prompt_create").setDescription("Create a new prompt.")
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("prompt_list").setDescription("List all your prompts.")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("prompt_update")
        .setDescription("Update a prompt.")
        .addStringOption((option) =>
          option
            .setName("name")
            .setDescription("The name of the prompt to update.")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("prompt")
            .setDescription("The new content of the prompt.")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("prompt_delete")
        .setDescription("Delete a prompt.")
        .addStringOption((option) =>
          option
            .setName("name")
            .setDescription("The name of the prompt to delete.")
            .setRequired(true)
        )
    ),
  execute: async (interaction: ChatInputCommandInteraction) => {
    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    if (!aiService) {
      throw new BusinessError("The AI service is currently unavailable.");
    }

    if (subcommand === "prompt_create") {
      const modal = createPromptModal();
      await interaction.showModal(modal);
    } else if (subcommand === "prompt_list") {
      await interaction.deferReply({ ephemeral: true });
      const prompts = await ticketDB
        .selectFrom("ai_prompts")
        .selectAll()
        .where("user_id", "=", userId)
        .execute();

      if (prompts.length === 0) {
        throw new BusinessError("You have no saved prompts.");
      }

      const embed = new EmbedBuilder()
        .setTitle("Your AI Prompts")
        .setDescription(
          prompts.map((p, i) => `\`${i + 1}.\` **${p.name}**`).join("\n")
        );

      await interaction.editReply({ embeds: [embed] });
    } else if (subcommand === "prompt_update") {
      await interaction.deferReply({ ephemeral: true });
      const name = interaction.options.getString("name", true);
      const prompt = interaction.options.getString("prompt", true);

      const result = await ticketDB
        .updateTable("ai_prompts")
        .set({ prompt })
        .where("user_id", "=", userId)
        .where("name", "=", name)
        .executeTakeFirst();

      if (result.numUpdatedRows > 0) {
        await interaction.editReply({
          content: `Prompt "${name}" updated successfully.`,
        });
      } else {
        throw new BusinessError(`Prompt "${name}" not found.`);
      }
    } else if (subcommand === "prompt_delete") {
      await interaction.deferReply();
      const name = interaction.options.getString("name", true);

      const result = await ticketDB
        .deleteFrom("ai_prompts")
        .where("user_id", "=", userId)
        .where("name", "=", name)
        .executeTakeFirst();

      if (result.numDeletedRows > 0) {
        await interaction.editReply({
          content: `Prompt "${name}" deleted successfully.`,
        });
      } else {
        throw new BusinessError(`Prompt "${name}" not found.`);
      }
    } else if (subcommand === "chat") {
      await interaction.deferReply();
      const clear = interaction.options.getBoolean("clear");

      let conversation = await ticketDB
        .selectFrom("ai_conversations")
        .selectAll()
        .where("user_id", "=", userId)
        .orderBy("updated_at", "desc")
        .executeTakeFirst();

      if (clear) {
        if (conversation) {
          await ticketDB
            .deleteFrom("ai_conversations")
            .where("id", "=", conversation.id)
            .execute();
          await interaction.editReply({
            content: "Conversation history cleared.",
          });
        } else {
          await interaction.editReply({
            content: "No conversation history to clear.",
          });
        }
        return;
      }

      if (conversation) {
        const history = await queries.getConversationHistory(
          ticketPool,
          conversation.id
        );
        const totalPages = Math.ceil(history.length / 10);
        const latestPage = totalPages > 0 ? totalPages - 1 : 0;
        const { embed, row } = createAIMessage(
          conversation.id,
          history,
          latestPage,
          interaction.user
        );
        const message = await interaction.editReply({
          embeds: [embed],
          components: [row],
        });
        await ticketDB
          .updateTable("ai_conversations")
          .set({ channel_id: message.channelId, message_id: message.id })
          .where("id", "=", conversation.id)
          .execute();
      } else {
        // No existing conversation, show prompts and start button
        const prompts = await ticketDB
          .selectFrom("ai_prompts")
          .selectAll()
          .where("user_id", "=", userId)
          .execute();

        const components = [];
        if (prompts.length > 0) {
          const selectMenu = new StringSelectMenuBuilder()
            .setCustomId("ai_prompt_select")
            .setPlaceholder("Select a prompt to start a new conversation...")
            .addOptions(
              prompts.map((p) => ({
                label: p.name,
                value: p.id.toString(),
              }))
            );
          const row =
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
              selectMenu
            );
          components.push(row);
        }

        const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`ai_continue_0`) // Start a new conversation
            .setLabel("Start Conversation")
            .setStyle(ButtonStyle.Success)
        );
        components.push(buttonRow);

        await interaction.editReply({
          content:
            "Start a new conversation by selecting a prompt or clicking the button below.",
          components,
        });
      }
    }
  },
};

export default command;
