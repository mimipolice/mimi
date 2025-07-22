import OpenAI from "openai";
import { Pool } from "pg";
import * as queries from "../shared/database/queries";
import logger from "../utils/logger";

export class AIService {
  private openai: OpenAI;
  private db: Pool;

  constructor(apiKey: string, apiEndpoint: string, db: Pool) {
    this.openai = new OpenAI({
      apiKey,
      baseURL: apiEndpoint,
    });
    this.db = db;
  }

  public async generateResponse(
    conversationId: number,
    prompt: { role: "system" | "user" | "assistant"; content: string },
    model: string = "gemini-2.5-pro"
  ): Promise<string> {
    try {
      // 1. Add user's new message to the database, if it's not a system message
      if (prompt.role !== "system") {
        await queries.addConversationMessage(
          this.db,
          conversationId,
          prompt.role,
          prompt.content
        );
      }

      // 2. Retrieve the full conversation history
      const history = await queries.getConversationHistory(
        this.db,
        conversationId
      );

      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [...history];
      if (prompt.role === "system") {
        messages.unshift({ role: "system", content: prompt.content });
      }

      // 3. Call the OpenAI API
      const completion = await this.openai.chat.completions.create({
        model,
        messages,
      });

      const replyContent = completion.choices[0].message.content ?? "";

      // 4. Save the assistant's reply to the database
      if (replyContent) {
        await queries.addConversationMessage(
          this.db,
          conversationId,
          "assistant",
          replyContent
        );
      }

      return replyContent;
    } catch (error) {
      if (error instanceof Error) {
        logger.error(`AI API request failed: ${error.message}`);
      } else {
        logger.error("An unknown error occurred during the AI API request.");
      }
      throw error;
    }
  }
}
