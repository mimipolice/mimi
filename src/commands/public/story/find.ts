import { ChatInputCommandInteraction, Client } from "discord.js";
import { Services } from "../../../interfaces/Command";
import logger from "../../../utils/logger";

export async function handleFind(
  interaction: ChatInputCommandInteraction,
  client: Client,
  { storyForumService }: Services
): Promise<void> {
  try {
    // Get subscription entry info
    const entry = await storyForumService.getSubscriptionEntry(
      interaction.channel!.id
    );

    if (!entry) {
      await interaction.editReply({
        content: "❌ 此討論串尚未創建訂閱入口。\n\n作者可以使用 `/sf entry` 來創建訂閱入口。",
      });
      return;
    }

    if (!entry.enabled) {
      await interaction.editReply({
        content: "❌ 此討論串的訂閱入口已被停用。",
      });
      return;
    }

    if (!entry.message_id) {
      await interaction.editReply({
        content: "❌ 訂閱入口訊息不存在或已被刪除。\n\n作者可以使用 `/sf entry` 重新創建。",
      });
      return;
    }

    // Try to fetch the message to verify it exists
    try {
      const message = await interaction.channel!.messages.fetch(entry.message_id);
      
      await interaction.editReply({
        content: `✅ 找到訂閱入口！\n\n📍 [點此前往訂閱入口訊息](${message.url})\n\n你可以點擊訊息下方的按鈕來訂閱此故事的更新通知。`,
      });
    } catch (error) {
      logger.warn(
        `[StoryFind] Message ${entry.message_id} not found in thread ${interaction.channel!.id}`,
        error
      );
      await interaction.editReply({
        content: "❌ 訂閱入口訊息似乎已被刪除。\n\n作者可以使用 `/sf entry` 重新創建。",
      });
    }
  } catch (error) {
    logger.error(
      `[StoryFind] Error finding subscription entry for thread ${interaction.channel!.id}`,
      error
    );
    await interaction.editReply({
      content: "❌ 查詢訂閱入口時發生錯誤。",
    });
  }
}
