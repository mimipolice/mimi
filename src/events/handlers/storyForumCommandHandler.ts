import { Message } from "discord.js";
import { Services } from "../../interfaces/Command";
import logger from "../../utils/logger";

export async function handleStoryForumCommand(
  message: Message,
  services: Services
): Promise<boolean> {
  if (!message.channel.isThread()) {
    return false;
  }

  const command = message.content.toLowerCase();
  
  // Only handle ?pin and ?unpin commands
  if (!command.startsWith("?pin") && !command.startsWith("?unpin")) {
    return false;
  }

  try {
    const threadInfo = await services.storyForumService.getThreadInfo(
      message.channel.id
    );

    if (!threadInfo || threadInfo.status !== "validated") {
      return false;
    }

    // Check if user has permission (author or authorized user)
    const hasPermission = await services.storyForumService.hasPermission(
      message.channel.id,
      message.author.id
    );

    if (!hasPermission) {
      await message.reply("❌ 只有貼文作者或授權使用者才能使用此指令。");
      return true;
    }

    if (!message.reference || !message.reference.messageId) {
      await message.reply("❌ 請回覆您想操作的訊息來使用此指令。");
      return true;
    }

    const targetMessage = await message.channel.messages.fetch(
      message.reference.messageId
    );

    if (command.startsWith("?pin")) {
      await targetMessage.pin();
      await message.reply("✅ 已釘選訊息。");
    } else if (command.startsWith("?unpin")) {
      await targetMessage.unpin();
      await message.reply("✅ 已取消釘選訊息。");
    }

    return true;
  } catch (error) {
    logger.error(
      `[StoryForumCommandHandler] Failed to handle command in thread ${message.channel.id}`,
      error
    );
    await message.reply("❌ 處理指令時發生錯誤。");
    return true;
  }
}
