import { ButtonInteraction, Client } from "discord.js";
import { Button } from "../../interfaces/Button";
import { Databases, Services } from "../../interfaces/Command";
import logger from "../../utils/logger";

export const button: Button = {
  name: /^story_entry_(yes|no|never):/,
  async execute(
    interaction: ButtonInteraction,
    client: Client,
    services: Services,
    databases: Databases
  ) {
    try {
      const [action, threadId, authorId] = interaction.customId.split(":");

      // Verify the user is the author
      if (interaction.user.id !== authorId) {
        await interaction.reply({
          content: "❌ 只有貼文作者可以進行此操作。",
          ephemeral: true,
        });
        return;
      }

      await interaction.deferReply({ ephemeral: true });

      if (action === "story_entry_yes") {
        // Create subscription entry
        const created = await services.storyForumService.createSubscriptionEntry(
          threadId
        );

        if (created) {
          // Send subscription entry message
          const sent = await services.storyForumService.sendSubscriptionEntryMessage(
            threadId
          );

          if (sent) {
            await interaction.editReply({
              content:
                "✅ 已成功創建訂閱入口！\n\n" +
                "訂閱入口訊息已發送到討論串中。\n" +
                "讀者現在可以點擊按鈕訂閱你的更新。\n" +
                "當你發布新內容後，使用 `/sf notify` 來通知所有訂閱者。\n\n" +
                "**提示：**\n" +
                "• 使用 `/sf permissions` 可以授權其他人推送更新（最多5人）\n" +
                "• 建議將訂閱入口訊息釘選到討論串頂部，方便讀者找到",
            });

            // Delete the prompt message
            await interaction.message.delete().catch(() => {});
          } else {
            await interaction.editReply({
              content: "❌ 發送訂閱入口訊息失敗，但資料庫記錄已創建。請稍後使用 `/sf entry` 重試。",
            });
          }
        } else {
          await interaction.editReply({
            content: "❌ 創建訂閱入口失敗，請稍後再試或使用 `/sf entry` 手動創建。",
          });
        }
      } else if (action === "story_entry_no") {
        // Don't create, but will ask again next time
        await interaction.editReply({
          content:
            "👌 好的，這次不創建訂閱入口。\n\n" +
            "下次發帖時還會再詢問你。如果之後想要創建，可以隨時使用 `/sf entry`。",
        });

        // Delete the prompt message
        await interaction.message.delete().catch(() => {});
      } else if (action === "story_entry_never") {
        // Set preference to never ask again
        const success = await services.storyForumService.setAuthorPreference(
          authorId,
          false
        );

        if (success) {
          await interaction.editReply({
            content:
              "✅ 已設定「不再提醒」。\n\n" +
              "以後發帖時不會再詢問你是否要創建訂閱入口。\n" +
              "如果需要創建，可以隨時在帖子中使用 `/sf entry`。\n\n" +
              "**提示：** 如果想要恢復詢問功能，請聯繫管理員。",
          });

          // Delete the prompt message
          await interaction.message.delete().catch(() => {});
        } else {
          await interaction.editReply({
            content: "❌ 設定偏好失敗，請稍後再試。",
          });
        }
      }
    } catch (error) {
      logger.error("[StoryEntryPrompt] Error handling button:", error);
      
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({
          content: "❌ 處理操作時發生錯誤。",
        });
      } else {
        await interaction.reply({
          content: "❌ 處理操作時發生錯誤。",
          ephemeral: true,
        });
      }
    }
  },
};

export default button;
