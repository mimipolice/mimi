import { Message, ChannelType, ForumChannel, TextChannel } from "discord.js";
import { Services } from "../../../interfaces/Command";
import logger from "../../../utils/logger";

export const cleanupTags = async (
  message: Message,
  args: string[],
  services: Services
): Promise<void> => {
  if (args.length < 3) {
    await message.reply(
      "Please provide a forum channel ID and two tag names (the second one will be removed)."
    );
    return;
  }

  const forumChannelId = args[0];
  const tagName1 = args[1];
  const tagNameToRemove = args[2];

  const channel = await message.client.channels.fetch(forumChannelId);

  if (!channel || channel.type !== ChannelType.GuildForum) {
    await message.reply("The provided channel is not a valid forum channel.");
    return;
  }

  const forumChannel = channel as ForumChannel;
  const availableTags = forumChannel.availableTags;
  const tag1 = availableTags.find((t) => t.name === tagName1);
  const tagToRemove = availableTags.find((t) => t.name === tagNameToRemove);

  if (!tag1 || !tagToRemove) {
    await message.reply(
      "One or both of the specified tags are not available in this forum."
    );
    return;
  }

  try {
    await message.reply("Processing... this may take a while.");
    const threads = await forumChannel.threads.fetch();
    let cleanedCount = 0;
    for (const thread of threads.threads.values()) {
      const hasTag1 = thread.appliedTags.includes(tag1.id);
      const hasTagToRemove = thread.appliedTags.includes(tagToRemove.id);

      if (hasTag1 && hasTagToRemove) {
        const newTags = thread.appliedTags.filter((t) => t !== tagToRemove.id);
        await thread.setAppliedTags(newTags);
        cleanedCount++;
      }
    }
    if (message.channel instanceof TextChannel) {
      await message.channel.send(
        `Cleanup complete. Removed the "${tagNameToRemove}" tag from ${cleanedCount} posts.`
      );
    }
  } catch (error) {
    logger.error(`Error cleaning up tags in forum threads (by <@${message.author.id}> / ${message.author.id}):`, error);
    if (message.channel instanceof TextChannel) {
      await message.channel.send(
        "An error occurred while trying to clean up the tags."
      );
    }
  }
};
