import { ButtonInteraction } from "discord.js";
import { Button } from "../../interfaces/Button";
import { ticketPool } from "../../shared/database";
import * as queries from "../../shared/database/queries";
import { BusinessError } from "../../errors";
import { createAIMessage } from "../../utils/aiMessageGenerator";

export default {
  name: "ai_history",
  execute: async (interaction: ButtonInteraction) => {
    const [_, conversationIdStr, pageStr] = interaction.customId.split("_");
    const conversationId = parseInt(conversationIdStr, 10);
    const page = parseInt(pageStr, 10);

    if (isNaN(conversationId) || isNaN(page)) {
      throw new BusinessError("Invalid button ID format.");
    }

    await interaction.deferUpdate();

    const history = await queries.getConversationHistory(
      ticketPool,
      conversationId
    );

    if (history.length === 0) {
      throw new BusinessError("No conversation history found.");
    }

    const { embed, row } = createAIMessage(
      conversationId,
      history,
      page,
      interaction.user
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
  },
} as Button;
