import {
  Events,
  Message,
  TextChannel,
  NewsChannel,
  ThreadChannel,
} from "discord.js";
import { getKeywordsForGuild, getAutoreactsForGuild } from "../shared/cache";
import { handleAntiSpam } from "../features/anti-spam/handler";
import { handleStoryForumCommand } from "./handlers/storyForumCommandHandler";

import { Client } from "discord.js";
import { Services, Databases } from "../interfaces/Command";
import { MessageCommand } from "../interfaces/MessageCommand";
import QsCommand from "../commands/admin/qs";
import QcCommand from "../commands/public/qc";
import UnqsCommand from "../commands/admin/unqs";
import TopCommand from "../commands/public/top";
import ForumCommand from "../commands/admin/forum";
import logger from "../utils/logger";

const messageCommands = new Map<string, MessageCommand>();
messageCommands.set(QsCommand.name, QsCommand);
if (QsCommand.aliases) {
  for (const alias of QsCommand.aliases) {
    messageCommands.set(alias, QsCommand);
  }
}
messageCommands.set(QcCommand.name, QcCommand);
if (QcCommand.aliases) {
  for (const alias of QcCommand.aliases) {
    messageCommands.set(alias, QcCommand);
  }
}
messageCommands.set(UnqsCommand.name, UnqsCommand);
if (UnqsCommand.aliases) {
  for (const alias of UnqsCommand.aliases) {
    messageCommands.set(alias, UnqsCommand);
  }
}
messageCommands.set(TopCommand.name, TopCommand);
if (TopCommand.aliases) {
  for (const alias of TopCommand.aliases) {
    messageCommands.set(alias, TopCommand);
  }
}
messageCommands.set(ForumCommand.name, ForumCommand);
if (ForumCommand.aliases) {
  for (const alias of ForumCommand.aliases) {
    messageCommands.set(alias, ForumCommand);
  }
}

module.exports = {
  name: Events.MessageCreate,
  once: false,
  async execute(
    message: Message,
    client: Client,
    services: Services,
    databases: Databases
  ) {
    // Log all messageCreate events for debugging
    logger.debug(
      `[messageCreate] Message from ${message.author.tag} in guild ${message.guild?.id || "DM"} channel ${message.channel.id}`
    );

    if (message.author.bot || !message.guild) {
      return;
    }

    // Story Forum Logic - DISABLED
    // await services.storyForumService.validateMessage(message);

    // Handle Story Forum specific commands like ?pin/?unpin
    if (await handleStoryForumCommand(message, services)) {
      return; // Stop further processing if it was a story forum command
    }

    const prefix = "?";
    if (message.content.startsWith(prefix)) {
      const args = message.content.slice(prefix.length).trim().split(/ +/);
      const commandName = args.shift()?.toLowerCase();

      if (commandName) {
        const command = messageCommands.get(commandName);
        if (command) {
          try {
            await command.execute(message, args, services, databases);
          } catch (error) {
            logger.error("Error executing message command:", {
              command: commandName,
              error,
              userId: message.author.id,
              guildId: message.guild?.id,
            });
            await message.reply(
              "There was an error trying to execute that command!"
            );
          }
        }
      }
    }

    // ?solve command logic
    await services.forumService.handleSolveCommand(message);

    // Anti-spam check
    try {
      await handleAntiSpam(message);
    } catch (error) {
      logger.error("[messageCreate] Error in handleAntiSpam:", error);
    }

    // Autoreact logic
    const autoreacts = await getAutoreactsForGuild(message.guild.id);
    for (const autoreact of autoreacts) {
      if (message.channel.id === autoreact.channel_id) {
        try {
          await message.react(autoreact.emoji);
        } catch (error: any) {
          if (error.code === 10014) {
            // Unknown Emoji error
            logger.warn(
              `Invalid emoji in autoreact for guild ${message.guild.id}, channel ${autoreact.channel_id}: "${autoreact.emoji}"`
            );
          } else {
            logger.error("Error adding autoreact:", error);
          }
        }
      }
    }

    // Keyword logic
    const guildKeywords = await getKeywordsForGuild(message.guild!.id);

    if (guildKeywords.length === 0) {
      return;
    }

    for (const kw of guildKeywords) {
      const content = message.content;
      let match = false;

      if (kw.match_type === "exact") {
        if (content === kw.keyword) {
          match = true;
        }
      } else if (kw.match_type === "contains") {
        if (content.includes(kw.keyword)) {
          match = true;
        }
      }

      if (match) {
        if (
          message.channel instanceof TextChannel ||
          message.channel instanceof NewsChannel ||
          message.channel instanceof ThreadChannel
        ) {
          await message.reply(kw.reply);
        }
        return;
      }
    }
  },
};
