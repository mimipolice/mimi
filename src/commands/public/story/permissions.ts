import {
  ChatInputCommandInteraction,
  Client,
  EmbedBuilder,
  Colors,
} from "discord.js";
import { Services } from "../../../interfaces/Command";
import logger from "../../../utils/logger";

export async function handlePermissions(
  interaction: ChatInputCommandInteraction,
  client: Client,
  { storyForumService }: Services,
  threadInfo: any
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "add") {
    await handleAddPermission(interaction, storyForumService, threadInfo);
  } else if (subcommand === "remove") {
    await handleRemovePermission(interaction, storyForumService, threadInfo);
  } else if (subcommand === "list") {
    await handleListPermissions(interaction, client, storyForumService, threadInfo);
  }
}

async function handleAddPermission(
  interaction: ChatInputCommandInteraction,
  storyForumService: any,
  threadInfo: any
): Promise<void> {
  // Check if user is the author
  if (interaction.user.id !== threadInfo.author_id) {
    await interaction.editReply({
      content: "❌ 只有貼文作者才能新增權限。",
    });
    return;
  }

  const targetUser = interaction.options.getUser("user", true);

  // Check if target is the author
  if (targetUser.id === threadInfo.author_id) {
    await interaction.editReply({
      content: "❌ 作者本身已經擁有所有權限。",
    });
    return;
  }

  // Check permission count (max 5 including author)
  const permissionCount = await storyForumService.getPermissionCount(
    interaction.channel!.id
  );

  if (permissionCount >= 5) {
    await interaction.editReply({
      content: "❌ 此帖子已達到權限上限（包含作者最多 5 人）。",
    });
    return;
  }

  // Add permission
  const success = await storyForumService.addPermission(
    interaction.channel!.id,
    targetUser.id,
    interaction.user.id
  );

  if (success) {
    await interaction.editReply({
      content: `✅ 已成功授予 <@${targetUser.id}> 更新推送權限！`,
    });
  } else {
    await interaction.editReply({
      content: "❌ 授予權限失敗，該用戶可能已經擁有權限。",
    });
  }
}

async function handleRemovePermission(
  interaction: ChatInputCommandInteraction,
  storyForumService: any,
  threadInfo: any
): Promise<void> {
  // Check if user is the author
  if (interaction.user.id !== threadInfo.author_id) {
    await interaction.editReply({
      content: "❌ 只有貼文作者才能移除權限。",
    });
    return;
  }

  const targetUser = interaction.options.getUser("user", true);

  // Check if target is the author
  if (targetUser.id === threadInfo.author_id) {
    await interaction.editReply({
      content: "❌ 無法移除作者本身的權限。",
    });
    return;
  }

  // Remove permission
  const success = await storyForumService.removePermission(
    interaction.channel!.id,
    targetUser.id
  );

  if (success) {
    await interaction.editReply({
      content: `✅ 已成功移除 <@${targetUser.id}> 的更新推送權限。`,
    });
  } else {
    await interaction.editReply({
      content: "❌ 移除權限失敗，該用戶可能沒有權限。",
    });
  }
}

async function handleListPermissions(
  interaction: ChatInputCommandInteraction,
  client: Client,
  storyForumService: any,
  threadInfo: any
): Promise<void> {
  const permissions = await storyForumService.getPermissions(
    interaction.channel!.id
  );

  const embed = new EmbedBuilder()
    .setColor(Colors.Blue)
    .setTitle("🔐 更新推送權限列表")
    .setDescription(
      `作者：<@${threadInfo.author_id}>\n\n${
        permissions.length > 0
          ? `其他擁有權限的用戶（${permissions.length}/4）：\n${permissions
              .map((userId: string) => `• <@${userId}>`)
              .join("\n")}`
          : "目前沒有其他用戶擁有權限"
      }`
    )
    .setFooter({
      text: `權限人數：${1 + permissions.length}/5（包含作者）`,
    })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
