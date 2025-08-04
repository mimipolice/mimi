import { gachaDB } from "../shared/database";

// AI Conversation Queries
export interface ConversationMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export async function createConversation(userId: string): Promise<number> {
  const now = new Date().toISOString();
  const result = await gachaDB
    .insertInto("ai_conversations")
    .values({
      user_id: userId,
      guild_id: "default",
      created_at: now,
      updated_at: now,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  return result.id;
}

export async function getConversationHistory(
  conversationId: number
): Promise<ConversationMessage[]> {
  return await gachaDB
    .selectFrom("ai_conversation_messages")
    .select(["role", "content"])
    .where("conversation_id", "=", conversationId)
    .orderBy("created_at", "asc")
    .execute();
}

export async function addConversationMessage(
  conversationId: number,
  role: "user" | "assistant",
  content: string
): Promise<void> {
  await gachaDB
    .insertInto("ai_conversation_messages")
    .values({
      conversation_id: conversationId,
      role: role,
      content: content,
      created_at: new Date().toISOString(),
    })
    .execute();

  await gachaDB
    .updateTable("ai_conversations")
    .set({ updated_at: new Date().toISOString() })
    .where("id", "=", conversationId)
    .execute();
}
