import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  User,
} from "discord.js";

const ITEMS_PER_PAGE = 10; // Number of messages per page

type Message = {
  role: "user" | "assistant" | "system";
  content: string;
};

/**
 * Creates a standardized embed and action row for AI conversation display.
 * @param conversationId - The ID of the conversation.
 * @param history - The full conversation history.
 * @param page - The current page number (0-indexed).
 * @param user - The user object to display their name and avatar.
 * @returns An object containing the embed and the action row.
 */
export function createAIMessage(
  conversationId: number,
  history: Message[],
  page: number,
  user: User
) {
  const chronologicalHistory = [...history].reverse();
  const totalPages = Math.ceil(chronologicalHistory.length / ITEMS_PER_PAGE);
  const startIndex = page * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const historyPage = chronologicalHistory.slice(startIndex, endIndex);

  const embed = new EmbedBuilder()
    .setAuthor({
      name: `AI Conversation with ${user.username}`,
      iconURL: user.displayAvatarURL(),
    })
    .setColor("#0099ff")
    .setFooter({ text: `Page ${page + 1} of ${totalPages}` });

  let description = "";
  for (const msg of historyPage) {
    if (msg.role === "system") continue; // Don't show system messages
    const roleName = msg.role === "user" ? user.username : "AI";
    let content = msg.content;
    if (msg.role === "assistant") {
      content = content.replace(/<thinking>[\s\S]*?<\/thinking>/g, "").trim();
    }
    description += `**${roleName}:** ${content}\n\n`;
  }

  embed.setDescription(description || "No messages in this conversation yet.");

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`ai_history_${conversationId}_${page - 1}`)
      .setLabel("Previous")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page <= 0),
    new ButtonBuilder()
      .setCustomId(`ai_history_${conversationId}_${page + 1}`)
      .setLabel("Next")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page >= totalPages - 1),
    new ButtonBuilder()
      .setCustomId(`ai_history_${conversationId}_${totalPages - 1}`)
      .setLabel("Latest")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages - 1),
    new ButtonBuilder()
      .setCustomId(`ai_continue_${conversationId}`)
      .setLabel("Continue Conversation")
      .setStyle(ButtonStyle.Success)
  );

  return { embed, row };
}
