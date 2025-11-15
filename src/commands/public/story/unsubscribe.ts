import { ChatInputCommandInteraction, Client } from "discord.js";
import { Services } from "../../../interfaces/Command";
import logger from "../../../utils/logger";

export async function handleUnsubscribe(
  interaction: ChatInputCommandInteraction,
  client: Client,
  { storyForumService }: Services
): Promise<void> {
  const typeOption = interaction.options.getString("type");

  if (typeOption === "all" || !typeOption) {
    // Unsubscribe from all types
    const success = await storyForumService.unsubscribeFromThread(
      interaction.channel!.id,
      interaction.user.id
    );

    if (success) {
      await interaction.editReply({
        content: "✅ 已成功取消訂閱此故事的所有通知。",
      });
    } else {
      await interaction.editReply({
        content: "❌ 你尚未訂閱此故事。",
      });
    }
  } else {
    const type = typeOption as "release" | "test" | "author_all";

    // Check if subscribed to this type
    const isSubscribed = await storyForumService.isUserSubscribed(
      interaction.channel!.id,
      interaction.user.id,
      type
    );

    if (!isSubscribed) {
      await interaction.editReply({
        content: `❌ 你尚未訂閱此類型（${
          type === "release"
            ? "Release"
            : type === "test"
            ? "Test"
            : "關注作者"
        }）。`,
      });
      return;
    }

    // Unsubscribe from specific type
    const success = await storyForumService.unsubscribeFromThread(
      interaction.channel!.id,
      interaction.user.id,
      type
    );

    if (success) {
      const typeName =
        type === "release"
          ? "Release（正式版）"
          : type === "test"
          ? "Test（測試版）"
          : "關注作者（所有更新）";

      await interaction.editReply({
        content: `✅ 已成功取消訂閱 **${typeName}**。`,
      });
    } else {
      await interaction.editReply({
        content: "❌ 取消訂閱失敗，請稍後再試。",
      });
    }
  }
}
