import { ChatInputCommandInteraction, Client } from "discord.js";
import { Services } from "../../../interfaces/Command";
import logger from "../../../utils/logger";

export async function handleEntry(
  interaction: ChatInputCommandInteraction,
  client: Client,
  { storyForumService }: Services,
  threadInfo: any
): Promise<void> {
  // Check if user is the author
  if (interaction.user.id !== threadInfo.author_id) {
    await interaction.editReply({
      content: "❌ 只有貼文作者才能創建訂閱入口。",
    });
    return;
  }

  // Check if entry already exists
  const hasEntry = await storyForumService.hasSubscriptionEntry(
    interaction.channel!.id
  );

  if (hasEntry) {
    await interaction.editReply({
      content: "ℹ️ 此帖子已經有訂閱入口了。",
    });
    return;
  }

  // Create entry
  const success = await storyForumService.createSubscriptionEntry(
    interaction.channel!.id
  );

  if (success) {
    await interaction.editReply({
      content:
        "✅ 已成功創建訂閱入口！\n\n用戶現在可以使用 `/sf 訂閱` 來訂閱你的更新。\n你可以使用 `/sf 推送更新` 來通知所有訂閱者。",
    });
  } else {
    await interaction.editReply({
      content: "❌ 創建訂閱入口失敗，請稍後再試。",
    });
  }
}
