import { Message, PermissionsBitField, ChannelType } from "discord.js";
import { setSolution } from "../../../repositories/forum.repository";
import { mimiDLCDb } from "../../../shared/database";
import { MessageCommand } from "../../../interfaces/MessageCommand";
import config from "../../../config";

const QsCommand: MessageCommand = {
  name: "qs",
  aliases: ["?qs"],
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

    if (!message.reference) {
      await message.reply(
        "❌ You must reply to a message to set it as the solution."
      );
      return;
    }

    const repliedMessage = await message.channel.messages.fetch(
      message.reference.messageId!
    );
    const threadId = repliedMessage.channelId;
    const tags = args;

    await setSolution(
      mimiDLCDb,
      threadId,
      repliedMessage.id,
      repliedMessage.author.id,
      tags.length > 0 ? tags : null
    );

    await message.reply({
      content: "✅ This message has been marked as the solution.",
    });
  },
};

export default QsCommand;
