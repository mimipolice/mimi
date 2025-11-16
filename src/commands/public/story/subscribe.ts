import { ChatInputCommandInteraction, Client } from "discord.js";
import { Services } from "../../../interfaces/Command";
import logger from "../../../utils/logger";

export async function handleSubscribe(
  interaction: ChatInputCommandInteraction,
  client: Client,
  { storyForumService }: Services
): Promise<void> {
  const type = (interaction.options.getString("type") || "release") as
    | "release"
    | "test"
    | "author_all";

  // Check if subscription entry exists
  const hasEntry = await storyForumService.hasSubscriptionEntry(
    interaction.channel!.id
  );

  if (!hasEntry) {
    await interaction.editReply({
      content:
        "❌ 此帖子尚未開啟訂閱功能。請聯繫作者使用 `/sf 創建入口` 開啟。",
    });
    return;
  }

  // Check if already subscribed to this type
  const isSubscribed = await storyForumService.isUserSubscribed(
    interaction.channel!.id,
    interaction.user.id,
    type
  );

  if (isSubscribed) {
    await interaction.editReply({
      content: `❌ 你已經訂閱了此類型（${
        type === "release"
          ? "Release"
          : type === "test"
          ? "Test"
          : "關注作者"
      }）的更新通知。`,
    });
    return;
  }

  // Subscribe
  const success = await storyForumService.subscribeToThread(
    interaction.channel!.id,
    interaction.user.id,
    type
  );

  if (success) {
    const releaseCount = await storyForumService.getSubscriberCount(
      interaction.channel!.id,
      "release"
    );
    const testCount = await storyForumService.getSubscriberCount(
      interaction.channel!.id,
      "test"
    );
    const authorAllCount = await storyForumService.getSubscriberCount(
      interaction.channel!.id,
      "author_all"
    );
    const typeName =
      type === "release"
        ? "Release（正式版）"
        : type === "test"
        ? "Test（測試版）"
        : "關注作者（所有更新）";

    await interaction.editReply({
      content: `✅ 已成功訂閱 **${typeName}**！\n當有對應更新時，你會收到提醒。\n\n📊 **目前訂閱統計**\n• Release: **${releaseCount}** 人\n• Test: **${testCount}** 人\n• 關注作者: **${authorAllCount}** 人`,
    });
  } else {
    await interaction.editReply({
      content: "❌ 訂閱失敗，請稍後再試。",
    });
  }
}
