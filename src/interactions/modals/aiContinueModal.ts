import {
  ModalSubmitInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  DiscordAPIError,
} from "discord.js";
import { Modal } from "../../interfaces/Modal";
import { ticketDB, ticketPool } from "../../shared/database";
import { AIService } from "../../services/AIService";
import * as queries from "../../shared/database/queries";
import { BusinessError } from "../../errors";
import { createAIMessage } from "../../utils/aiMessageGenerator";

const apiKey = process.env.OPENAI_API_KEY;
const apiEndpoint = process.env.OPENAI_API_ENDPOINT;

let aiService: AIService | null = null;
if (apiKey && apiEndpoint) {
  aiService = new AIService(apiKey, apiEndpoint, ticketPool);
}

export function createContinueModal(
  conversationId: number,
  promptId: string | number = "none"
): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`ai_continue_modal_${conversationId}_${promptId}`)
    .setTitle("Continue Conversation")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("message")
          .setLabel("Your Message")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
      )
    );
}

export default {
  name: "ai_continue_modal",
  execute: async (interaction: ModalSubmitInteraction) => {
    await interaction.deferReply();
    if (!aiService) {
      throw new BusinessError(
        "AI service is not configured. Please set OPENAI_API_KEY and OPENAI_API_ENDPOINT in the environment variables."
      );
    }

    const message = interaction.fields.getTextInputValue("message");
    const parts = interaction.customId.split("_");
    const conversationIdStr = parts[3];
    const promptId = parts.slice(4).join("_") || "none";
    const conversationId = parseInt(conversationIdStr, 10);
    const userId = interaction.user.id;
    if (isNaN(conversationId)) {
      throw new BusinessError("Invalid conversation ID.");
    }

    try {
      let currentConversationId = conversationId;
      let conversation;

      // If conversationId is 0, it's a new conversation
      if (currentConversationId === 0) {
        currentConversationId = await queries.createConversation(
          ticketPool,
          userId
        );
      } else {
        // Otherwise, fetch the existing conversation
        conversation = await ticketDB
          .selectFrom("ai_conversations")
          .selectAll()
          .where("id", "=", currentConversationId)
          .where("user_id", "=", userId)
          .executeTakeFirst();

        if (!conversation) {
          throw new BusinessError(
            "The conversation you are trying to continue does not exist or has been cleared."
          );
        }
      }

      // Prepare the prompt (system or user)
      let prompt: { role: "system" | "user"; content: string } | undefined;
      if (promptId && promptId !== "none") {
        const dbPrompt = await ticketDB
          .selectFrom("ai_prompts")
          .selectAll()
          .where("id", "=", parseInt(promptId, 10))
          .where("user_id", "=", userId)
          .executeTakeFirst();

        if (dbPrompt) {
          prompt = { role: "system", content: dbPrompt.prompt };
        } else {
          throw new BusinessError("Prompt not found.");
        }
      }

      // Generate response
      await aiService.generateResponse(
        currentConversationId,
        prompt
          ? { role: "system", content: prompt.content }
          : { role: "user", content: message },
        "gemini-2.5-pro"
      );
      if (prompt) {
        await queries.addConversationMessage(
          ticketPool,
          currentConversationId,
          "user",
          message
        );
      }

      // Display the interaction
      const history = await queries.getConversationHistory(
        ticketPool,
        currentConversationId
      );
      const totalPages = Math.ceil(history.length / 10); // 10 is ITEMS_PER_PAGE
      const latestPage = totalPages > 0 ? totalPages - 1 : 0;

      const { embed, row } = createAIMessage(
        currentConversationId,
        history,
        latestPage,
        interaction.user
      );

      // If it's a new conversation, edit the original reply.
      // Otherwise, edit the existing conversation message.
      if (conversationId === 0) {
        const message = await interaction.editReply({
          embeds: [embed],
          components: [row],
        });
        await ticketDB
          .updateTable("ai_conversations")
          .set({ channel_id: message.channelId, message_id: message.id })
          .where("id", "=", currentConversationId)
          .execute();
      } else if (conversation?.channel_id && conversation?.message_id) {
        const channel = await interaction.client.channels.fetch(
          conversation.channel_id
        );
        if (channel && channel.isTextBased()) {
          const message = await channel.messages.fetch(conversation.message_id);
          await message.edit({
            embeds: [embed],
            components: [row],
          });
        }
      } else {
        // Fallback for older conversations that might not have message_id/channel_id
        await interaction.editReply({
          embeds: [embed],
          components: [row],
        });
        const reply = await interaction.fetchReply();
        await ticketDB
          .updateTable("ai_conversations")
          .set({ channel_id: reply.channelId, message_id: reply.id })
          .where("id", "=", currentConversationId)
          .execute();
      }
    } catch (error) {
      if (error instanceof DiscordAPIError && error.code === 50001) {
        await interaction.editReply({
          content:
            "I don't have permission to view this channel. Please check my permissions and try again.",
        });
      } else if (error instanceof Error) {
        await interaction.editReply({
          content: `Error chatting with AI: ${error.message}`,
        });
      } else {
        await interaction.editReply({
          content: "An unknown error occurred while chatting with the AI.",
        });
      }
    }
  },
} as Modal;
