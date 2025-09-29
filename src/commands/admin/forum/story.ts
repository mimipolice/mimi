import { Message, ChannelType } from "discord.js";
import { Services } from "../../../interfaces/Command";
import config from "../../../config";

export const story = async (
  message: Message,
  args: string[],
  { settingsManager }: Services
): Promise<void> => {
  if (!message.guild || message.guild.id !== config.discord.guildId) {
    await message.reply(
      "This command can only be used in the development guild."
    );
    return;
  }

  const subCommand = args.shift()?.toLowerCase();
  const channelId = args.shift();

  if (!subCommand || !["set", "remove", "view"].includes(subCommand)) {
    await message.reply("Usage: `?forum story <set|remove|view> [channelId]`");
    return;
  }

  const settings = await settingsManager.getSettings(message.guild.id);
  const storyForums = settings?.story_forum_channels || [];

  switch (subCommand) {
    case "set": {
      if (!channelId) {
        await message.reply("Please provide a forum channel ID to set.");
        return;
      }
      const channel = await message.guild.channels
        .fetch(channelId)
        .catch(() => null);
      if (!channel || channel.type !== ChannelType.GuildForum) {
        await message.reply("Invalid channel ID or it's not a forum channel.");
        return;
      }
      if (storyForums.includes(channelId)) {
        await message.reply("This channel is already set as a story forum.");
        return;
      }
      const newForums = [...storyForums, channelId];
      await settingsManager.updateSettings(message.guild.id, {
        story_forum_channels: newForums,
      });
      await message.reply(
        `✅ Successfully set <#${channelId}> as a story forum.`
      );
      break;
    }
    case "remove": {
      if (!channelId) {
        await message.reply("Please provide a forum channel ID to remove.");
        return;
      }
      if (!storyForums.includes(channelId)) {
        await message.reply("This channel is not a story forum.");
        return;
      }
      const newForums = storyForums.filter((id) => id !== channelId);
      await settingsManager.updateSettings(message.guild.id, {
        story_forum_channels: newForums,
      });
      await message.reply(
        `✅ Successfully removed <#${channelId}> from story forums.`
      );
      break;
    }
    case "view": {
      if (storyForums.length === 0) {
        await message.reply("No story forums are configured.");
        return;
      }
      const list = storyForums.map((id) => `- <#${id}>`).join("\n");
      await message.reply(`**Configured Story Forums:**\n${list}`);
      break;
    }
  }
};
