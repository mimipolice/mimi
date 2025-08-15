import { Message, Locale } from "discord.js";
import { MessageCommand } from "../../../interfaces/MessageCommand";
import { getLocalizations } from "../../../utils/localization";

const TopCommand: MessageCommand = {
  name: "top",
  aliases: ["?top"],
  async execute(message: Message, args: string[], { localizationManager }) {
    const translations = getLocalizations(localizationManager, "top");
    const locale = message.guild?.preferredLocale || Locale.EnglishUS;
    const t = translations[locale] ?? translations["en-US"];

    const channel = message.channel;

    try {
      const messages = await channel.messages.fetch({ after: "0", limit: 1 });
      const firstMessage = messages.first();

      if (firstMessage) {
        await message.reply(firstMessage.url);
      } else {
        await message.reply(t.responses.no_messages);
      }
    } catch (error: any) {
      console.error("Error fetching the first message:", error);
      if (error.code === 50013) {
        await message.reply(t.responses.no_permission);
      } else {
        await message.reply(t.responses.fetch_error);
      }
    }
  },
};

export default TopCommand;
