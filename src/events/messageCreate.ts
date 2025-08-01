import {
  Events,
  Message,
  TextChannel,
  NewsChannel,
  ThreadChannel,
} from "discord.js";
import { getKeywordsCache, Keyword } from "../shared/cache";
import { handleAntiSpam } from "../features/anti-spam/handler";
import { getKeywordsByGuild } from "../shared/database/queries";
import { mimiDLCDb } from "../shared/database";

module.exports = {
  name: Events.MessageCreate,
  once: false,
  async execute(message: Message) {
    if (message.author.bot || !message.guild) {
      return;
    }

    // Anti-spam check
    await handleAntiSpam(message);

    let guildKeywords: Keyword[] | undefined = getKeywordsCache()?.filter(
      (kw) => kw.guild_id === message.guild!.id
    );

    if (!guildKeywords) {
      guildKeywords = await getKeywordsByGuild(mimiDLCDb, message.guild!.id);
    }

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
