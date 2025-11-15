import { ChatInputCommandInteraction, Client } from "discord.js";
import { Services } from "../../../interfaces/Command";
import logger from "../../../utils/logger";

export async function handleNotify(
  interaction: ChatInputCommandInteraction,
  client: Client,
  { storyForumService }: Services
): Promise<void> {
  // Check if user has permission (author or granted permission)
  const hasPermission = await storyForumService.hasPermission(
    interaction.channel!.id,
    interaction.user.id
  );

  if (!hasPermission) {
    await interaction.editReply({
      content: "❌ 你沒有權限推送更新通知。只有作者和授權用戶可以使用此功能。",
    });
    return;
  }

  const type = interaction.options.getString("type", true) as
    | "release"
    | "test";
  const link = interaction.options.getString("link", true);
  const description = interaction.options.getString("description");

  // Validate message link format
  if (
    !link.startsWith("https://discord.com/channels/") &&
    !link.startsWith("https://ptb.discord.com/channels/") &&
    !link.startsWith("https://canary.discord.com/channels/")
  ) {
    await interaction.editReply({
      content:
        "❌ 請提供有效的Discord訊息連結。\n\n**如何複製連結：**\n• 電腦：右鍵點擊訊息 → 複製訊息連結\n• 手機：長按訊息 → 複製訊息連結",
    });
    return;
  }

  // Send notification
  const count = await storyForumService.notifySubscribers(
    interaction.channel! as any,
    interaction.user.id,
    type,
    link,
    description || undefined
  );

  if (count > 0) {
    const typeName = type === "release" ? "Release" : "Test";
    await interaction.editReply({
      content: `✅ 已成功推送 **${typeName}** 更新通知！\n通知了 ${count} 位訂閱者。`,
    });
  } else {
    await interaction.editReply({
      content: "ℹ️ 目前沒有訂閱者，或所有訂閱者都是作者本人。",
    });
  }
}
