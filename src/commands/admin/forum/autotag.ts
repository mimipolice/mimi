import { Message, ChannelType, ForumChannel } from "discord.js";
import { Services } from "../../../interfaces/Command";

export const autotag = async (
  message: Message,
  args: string[],
  services: Services
): Promise<void> => {
  const subCommand = args.shift()?.toLowerCase();
  const forumChannelId = args.shift();

  if (!message.guild) return;

  if (!forumChannelId) {
    await message.reply("Please provide a forum channel ID.");
    return;
  }

  const channel = await message.client.channels.fetch(forumChannelId);
  if (!channel || channel.type !== ChannelType.GuildForum) {
    await message.reply("The provided channel is not a valid forum channel.");
    return;
  }
  const forumChannel = channel as ForumChannel;

  const settings = await services.settingsManager.getSettings(message.guild.id);
  const autotags = settings?.forum_autotags
    ? JSON.parse(settings.forum_autotags)
    : {};

  switch (subCommand) {
    case "set":
      const tagName = args.shift();
      if (!tagName) {
        await message.reply("Please provide a tag name to set.");
        return;
      }
      const tagToSet = forumChannel.availableTags.find(
        (t) => t.name === tagName
      );
      if (!tagToSet) {
        await message.reply(
          `The tag "${tagName}" is not available in this forum.`
        );
        return;
      }
      autotags[forumChannelId] = tagToSet.id;
      await services.settingsManager.updateSettings(message.guild.id, {
        forum_autotags: JSON.stringify(autotags),
      });
      await message.reply(
        `Successfully set the autotag to "${tagName}" for this forum.`
      );
      break;
    case "view":
      const autotagId = autotags[forumChannelId];
      if (!autotagId) {
        await message.reply("No autotag is set for this forum.");
        return;
      }
      const tagNameFromId = forumChannel.availableTags.find(
        (t) => t.id === autotagId
      )?.name;
      await message.reply(
        `The autotag for this forum is set to "${tagNameFromId}".`
      );
      break;
    case "remove":
      delete autotags[forumChannelId];
      await services.settingsManager.updateSettings(message.guild.id, {
        forum_autotags: JSON.stringify(autotags),
      });
      await message.reply("Successfully removed the autotag for this forum.");
      break;
    default:
      await message.reply(
        "Invalid subcommand. Use `set`, `view`, or `remove`."
      );
      break;
  }
};
