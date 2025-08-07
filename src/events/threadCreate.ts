import { Events, ThreadChannel, ChannelType } from "discord.js";
import config from "../config";
import logger from "../utils/logger";

module.exports = {
  name: Events.ThreadCreate,
  once: false,
  async execute(thread: ThreadChannel, newlyCreated: boolean) {
    // This feature is only for the dev server
    if (thread.guild.id !== config.discord.guildId) {
      return;
    }

    // Only for forum channels and only when the thread is first created
    if (thread.parent?.type !== ChannelType.GuildForum || !newlyCreated) {
      return;
    }

    try {
      const starterMessage = await thread.fetchStarterMessage();
      if (starterMessage && !starterMessage.pinned) {
        await starterMessage.pin();
        logger.info(
          `Pinned starter message in thread ${thread.name} (${thread.id}) in guild ${thread.guild.name}.`
        );
      }
    } catch (error) {
      logger.error(
        `Failed to pin starter message in thread ${thread.id}:`,
        error
      );
    }
  },
};
