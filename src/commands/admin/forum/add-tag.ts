import { Message, ChannelType, ForumChannel, TextChannel } from "discord.js";
import { Services } from "../../../interfaces/Command";

export const addTag = async (
  message: Message,
  args: string[],
  services: Services
): Promise<void> => {
  if (args.length < 2) {
    await message.reply("Please provide a forum channel ID and a tag to add.");
    return;
  }

  const forumChannelId = args[0];
  const tagName = args[1];

  const channel = await message.client.channels.fetch(forumChannelId);

  if (!channel || channel.type !== ChannelType.GuildForum) {
    await message.reply("The provided channel is not a valid forum channel.");
    return;
  }

  const forumChannel = channel as ForumChannel;
  const availableTags = forumChannel.availableTags;
  const tagToAdd = availableTags.find((t) => t.name === tagName);

  if (!tagToAdd) {
    await message.reply(`The tag "${tagName}" is not available in this forum.`);
    return;
  }

  try {
    await message.reply(`Processing... this may take a while.`);
    const threads = await forumChannel.threads.fetch();
    for (const thread of threads.threads.values()) {
      const newTags = [...thread.appliedTags, tagToAdd.id];
      await thread.setAppliedTags(newTags);
    }
    if (message.channel instanceof TextChannel) {
      await message.channel.send(
        `Successfully added the "${tagName}" tag to all posts in the forum.`
      );
    }
  } catch (error) {
    console.error("Error adding tag to forum threads:", error);
    if (message.channel instanceof TextChannel) {
      await message.channel.send(
        "An error occurred while trying to add the tag."
      );
    }
  }
};
