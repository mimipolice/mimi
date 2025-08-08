import { Message, ChannelType, ThreadChannel } from "discord.js";
import config from "../config";
import logger from "../utils/logger";

export class ForumService {
  public async handleSolveCommand(message: Message): Promise<void> {
    if (
      !message.guild ||
      message.guild.id !== config.discord.guildId ||
      !message.channel.isThread() ||
      message.content.trim() !== "?solved"
    ) {
      return;
    }

    const thread = message.channel as ThreadChannel;
    const starterMessage = await thread.fetchStarterMessage().catch(() => null);
    if (!starterMessage) return;

    const member = await message.guild.members.fetch(message.author.id);
    const isOwner = starterMessage.author.id === message.author.id;
    const isAdmin = member.permissions.has("ManageThreads");

    if (!isOwner && !isAdmin) {
      return;
    }

    const forumChannel = thread.parent;
    if (forumChannel?.type !== ChannelType.GuildForum) {
      return;
    }

    const solveTag = forumChannel.availableTags.find(
      (tag) => tag.name.toLowerCase() === "solved"
    );

    if (!solveTag) {
      await message.reply("此論壇沒有 'Solved' 標籤。請管理員先建立一個。");
      return;
    }

    try {
      const newTags = [...new Set([...thread.appliedTags, solveTag.id])];
      await thread.setAppliedTags(newTags);
      await thread.setLocked(true);
      await message.react("✅");
    } catch (error) {
      logger.error(`Failed to solve thread ${thread.id}:`, error);
      await message.reply("發生錯誤，無法標記此貼文為已解決。");
    }
  }
}
