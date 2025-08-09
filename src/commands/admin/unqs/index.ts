import { Message, PermissionsBitField, ChannelType } from "discord.js";
import { removeSolution } from "../../../repositories/forum.repository";
import { mimiDLCDb } from "../../../shared/database";
import { MessageCommand } from "../../../interfaces/MessageCommand";
import config from "../../../config";

const UnqsCommand: MessageCommand = {
  name: "unqs",
  aliases: ["?unqs"],
  async execute(message: Message, args: string[]) {
    if (message.guild?.id !== config.discord.guildId) return;
    if (
      !message.member?.permissions.has(PermissionsBitField.Flags.ManageMessages)
    ) {
      return;
    }

    if (
      message.channel.type !== ChannelType.PublicThread &&
      message.channel.type !== ChannelType.PrivateThread
    ) {
      await message.reply("❌ This command can only be used in threads.");
      return;
    }

    await removeSolution(mimiDLCDb, message.channelId);

    await message.reply({
      content: "✅ The solution has been removed from this thread.",
    });
  },
};

export default UnqsCommand;
