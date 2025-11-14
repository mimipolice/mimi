import { Message, ChannelType, ForumChannel, TextChannel } from "discord.js";
import { Services } from "../../../interfaces/Command";
import logger from "../../../utils/logger";

export const addTag = async (
  message: Message,
  args: string[],
  services: Services
): Promise<void> => {
  if (args.length < 2) {
    await message.reply(
      "Usage: `?forum add-tag <forumChannelId> <tagName> [excludeTagName]`"
    );
    return;
  }

  const forumChannelId = args[0];
  const tagName = args[1];
  const excludeTagName = args[2];

  const channel = await message.client.channels.fetch(forumChannelId);

  if (!channel || channel.type !== ChannelType.GuildForum) {
    await message.reply("The provided channel is not a valid forum channel.");
    return;
  }

  const forumChannel = channel as ForumChannel;
  const availableTags = forumChannel.availableTags;
  const tagToAdd = availableTags.find((t) => t.name === tagName);
  const excludeTag = excludeTagName
    ? availableTags.find((t) => t.name === excludeTagName)
    : null;

  if (!tagToAdd) {
    await message.reply(`The tag "${tagName}" is not available in this forum.`);
    return;
  }

  if (excludeTagName && !excludeTag) {
    await message.reply(
      `The exclude tag "${excludeTagName}" is not available in this forum.`
    );
    return;
  }

  try {
    await message.reply(`Processing... this may take a while.`);
    const threads = await forumChannel.threads.fetch();
    let updatedCount = 0;
    for (const thread of threads.threads.values()) {
      // Skip if the thread already has the tag to add
      if (thread.appliedTags.includes(tagToAdd.id)) {
        continue;
      }

      // Skip if the thread has the exclude tag
      if (excludeTag && thread.appliedTags.includes(excludeTag.id)) {
        continue;
      }

      const newTags = [...thread.appliedTags, tagToAdd.id];
      await thread.setAppliedTags(newTags);
      updatedCount++;
    }
    if (message.channel instanceof TextChannel) {
      await message.channel.send(
        `Successfully added the "${tagName}" tag to ${updatedCount} posts in the forum.`
      );
    }
  } catch (error) {
    logger.error("Error adding tag to forum threads:", error);
    if (message.channel instanceof TextChannel) {
      await message.channel.send(
        "An error occurred while trying to add the tag."
      );
    }
  }
};
