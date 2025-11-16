import { ButtonInteraction, Client } from "discord.js";
import { Button } from "../../interfaces/Button";
import { Databases, Services } from "../../interfaces/Command";
import logger from "../../utils/logger";

export const button: Button = {
  name: /^story_(subscribe|unsubscribe):/,
  async execute(
    interaction: ButtonInteraction,
    client: Client,
    services: Services,
    databases: Databases
  ) {
    try {
      const parts = interaction.customId.split(":");
      const action = parts[0]; // story_subscribe or story_unsubscribe
      const threadId = parts[1];
      const subscriptionType = parts[2] as "release" | "test" | "author_all" | undefined;

      await interaction.deferReply({ ephemeral: true });

      if (action === "story_subscribe") {
        if (!subscriptionType) {
          await interaction.editReply({
            content: "❌ 無效的訂閱類型。",
          });
          return;
        }

        // Subscribe
        const success = await services.storyForumService.subscribeToThread(
          threadId,
          interaction.user.id,
          subscriptionType
        );

        if (success) {
          const typeNames = {
            release: "Release（正式版）",
            test: "Test（測試版）",
            author_all: "關注作者（所有更新）",
          };

          const releaseCount = await services.storyForumService.getSubscriberCount(
            threadId,
            "release"
          );
          const testCount = await services.storyForumService.getSubscriberCount(
            threadId,
            "test"
          );
          const authorAllCount = await services.storyForumService.getSubscriberCount(
            threadId,
            "author_all"
          );

          await interaction.editReply({
            content:
              `✅ 已成功訂閱 **${typeNames[subscriptionType]}** 更新！\n\n` +
              "當作者發布相應類型的更新時，bot 會在此討論串 @ 你。\n\n" +
              "**提示：**\n" +
              "• 你可以點擊「取消訂閱」按鈕來取消訂閱\n" +
              "• 你可以同時訂閱多種類型的更新\n\n" +
              `📊 **目前訂閱統計**\n` +
              `• Release: **${releaseCount}** 人\n` +
              `• Test: **${testCount}** 人\n` +
              `• 關注作者: **${authorAllCount}** 人`,
          });
        } else {
          await interaction.editReply({
            content: "❌ 訂閱失敗，你可能已經訂閱過此類型了。",
          });
        }
      } else if (action === "story_unsubscribe") {
        // Unsubscribe from all types
        const success = await services.storyForumService.unsubscribeFromThread(
          threadId,
          interaction.user.id
        );

        if (success) {
          await interaction.editReply({
            content:
              "✅ 已成功取消所有訂閱！\n\n" +
              "你將不再收到此故事的更新通知。\n" +
              "如果之後想要重新訂閱，可以隨時點擊訂閱按鈕。",
          });
        } else {
          await interaction.editReply({
            content: "❌ 取消訂閱失敗，你可能沒有訂閱此故事。",
          });
        }
      }

      // Update the subscription entry message statistics (edit existing message)
      await services.storyForumService.sendSubscriptionEntryMessage(threadId).catch((error) => {
        logger.warn(
          `[StorySubscribe] Failed to update subscription entry message for thread ${threadId}`,
          error
        );
      });
    } catch (error) {
      logger.error("[StorySubscribe] Error handling button:", error);

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({
          content: "❌ 處理訂閱操作時發生錯誤。",
        });
      } else {
        await interaction.reply({
          content: "❌ 處理訂閱操作時發生錯誤。",
          ephemeral: true,
        });
      }
    }
  },
};

export default button;
