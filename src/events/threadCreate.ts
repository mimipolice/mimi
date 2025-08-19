import { Events, ThreadChannel, ChannelType, Client } from "discord.js";
import config from "../config";
import logger from "../utils/logger";
import { Databases, Services } from "../interfaces/Command";

module.exports = {
  name: Events.ThreadCreate,
  once: false,
  async execute(
    thread: ThreadChannel,
    client: Client,
    services: Services,
    databases: Databases
  ) {
    // This feature is only for the dev server
    if (thread.guild.id !== config.discord.guildId) {
      return;
    }

    // Only for forum channels and only when the thread is first created
    if (thread.parent?.type !== ChannelType.GuildForum) {
      return;
    }

    // Autotag logic
    if (thread.parentId) {
      const settings = await services.settingsManager.getSettings(
        thread.guild.id
      );
      if (settings && settings.forum_autotags) {
        const autotags = JSON.parse(settings.forum_autotags);
        const tagId = autotags[thread.parentId];
        if (tagId) {
          const newTags = [...new Set([...thread.appliedTags, tagId])];
          await thread.setAppliedTags(newTags);
        }
      }
    }

    try {
      // Wait for 2 seconds before fetching the starter message
      await new Promise((resolve) => setTimeout(resolve, 1000));
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
