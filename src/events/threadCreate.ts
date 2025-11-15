import { Events, ThreadChannel, ChannelType, Client } from "discord.js";
import config from "../config";
import logger from "../utils/logger";
import { Databases, Services } from "../interfaces/Command";

module.exports = {
  name: Events.ThreadCreate,
  once: false,
  async execute(
    thread: ThreadChannel,
    _newlyCreated: boolean,
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

    // Story Forum Logic
    const storyForumSettings = await services.settingsManager.getSettings(
      thread.guild.id
    );
    const isStoryForum = storyForumSettings?.story_forum_channels?.includes(
      thread.parentId!
    );

    if (isStoryForum && thread.ownerId) {
      try {
        await services.storyForumService.registerThread(thread);
        
        // Check if author wants to be asked about subscription entry
        const askOnPost = await services.storyForumService.getAuthorPreference(
          thread.ownerId
        );
        
        if (askOnPost) {
          // Wait a bit for the thread to be fully created
          setTimeout(async () => {
            try {
              await services.storyForumService.askAboutSubscriptionEntry(
                thread,
                thread.ownerId!
              );
            } catch (error) {
              logger.error(
                `[StoryForum] Failed to ask about subscription entry for thread ${thread.id}`,
                error
              );
            }
          }, 3000);
        }
      } catch (error) {
        logger.error(
          `[StoryForum] Failed to register thread ${thread.id}`,
          error
        );
      }
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
