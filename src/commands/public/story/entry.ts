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
  const created = await storyForumService.createSubscriptionEntry(
    interaction.channel!.id
  );

  if (created) {
    // Send subscription entry message
    const sent = await storyForumService.sendSubscriptionEntryMessage(
      interaction.channel!.id
    );

    if (sent) {
      await interaction.editReply({
        content:
          "✅ 已成功創建訂閱入口！\n\n" +
          "訂閱入口訊息已發送到討論串中。\n" +
          "讀者現在可以點擊按鈕訂閱你的更新。\n" +
          "當你發布新內容後，使用 `/sf notify` 來通知所有訂閱者。\n\n" +
          "**提示：** 建議將訂閱入口訊息釘選到討論串頂部，方便讀者找到。",
      });
    } else {
      await interaction.editReply({
        content: "❌ 發送訂閱入口訊息失敗，但資料庫記錄已創建。請稍後再試。",
      });
    }
  } else {
    await interaction.editReply({
      content: "❌ 創建訂閱入口失敗，請稍後再試。",
    });
  }
}
