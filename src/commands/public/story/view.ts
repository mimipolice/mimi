import {
  ChatInputCommandInteraction,
  Client,
  EmbedBuilder,
  Colors,
} from "discord.js";
import { Services } from "../../../interfaces/Command";
import logger from "../../../utils/logger";

export async function handleView(
  interaction: ChatInputCommandInteraction,
  client: Client,
  { storyForumService }: Services
): Promise<void> {
  const subscriptions = await storyForumService.getAllUserSubscriptions(
    interaction.user.id
  );

  if (subscriptions.length === 0) {
    await interaction.editReply({
      content: "你還沒有訂閱任何帖子。",
    });
    return;
  }

  // Build embed with subscription list
  const embed = new EmbedBuilder()
    .setColor(Colors.Blue)
    .setTitle("📚 我的訂閱列表")
    .setDescription(
      `你總共訂閱了 ${subscriptions.length} 個帖子/作者\n以下是你的訂閱清單：`
    )
    .setTimestamp();

  for (const sub of subscriptions) {
    try {
      const channel = await client.channels.fetch(sub.thread_id);
      if (channel && channel.isThread()) {
        const typeText =
          sub.subscription_type === "release"
            ? "🔔 正式版"
            : sub.subscription_type === "test"
              ? "🧪 測試版"
              : "👤 關注作者";

        embed.addFields({
          name: `${channel.name}`,
          value: `類型：${typeText}\n訂閱於：<t:${Math.floor(new Date(sub.subscribed_at).getTime() / 1000)}:R>\n[前往帖子](https://discord.com/channels/${channel.guildId}/${channel.id})`,
          inline: false,
        });
      }
    } catch (error) {
      logger.error(`Failed to fetch channel ${sub.thread_id}:`, error);
      // Skip this subscription if channel doesn't exist
      continue;
    }
  }

  await interaction.editReply({ embeds: [embed] });
}
