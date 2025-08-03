import {
  Events,
  Message,
  TextChannel,
  NewsChannel,
  ThreadChannel,
} from "discord.js";
import { getKeywordsForGuild, getAutoreactsForGuild } from "../shared/cache";
import { handleAntiSpam } from "../features/anti-spam/handler";

module.exports = {
  name: Events.MessageCreate,
  once: false,
  async execute(message: Message) {
    if (message.author.bot || !message.guild) {
      return;
    }

    // Anti-spam check
    await handleAntiSpam(message);

    // Autoreact logic
    const autoreacts = await getAutoreactsForGuild(message.guild.id);
    for (const autoreact of autoreacts) {
      if (message.channel.id === autoreact.channel_id) {
        await message.react(autoreact.emoji);
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
