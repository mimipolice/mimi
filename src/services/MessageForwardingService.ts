import {
  Message,
  Client,
  TextChannel,
  NewsChannel,
  ThreadChannel,
  ChannelType,
} from "discord.js";
import logger from "../utils/logger";

export class MessageForwardingService {
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  public async handleMessageForwarding(message: Message): Promise<void> {
    if (!message.guild) return;

    const messageLinkRegex =
      /https:\/\/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/g;
    const match = messageLinkRegex.exec(message.content);

    if (match) {
      const [_, guildId, channelId, messageId] = match;

      if (guildId === message.guild.id) {
        try {
          const channel = await this.client.channels.fetch(channelId);
          if (
            channel &&
            (channel.type === ChannelType.GuildText ||
              channel.type === ChannelType.GuildAnnouncement ||
              channel.type === ChannelType.PublicThread ||
              channel.type === ChannelType.PrivateThread)
          ) {
            const targetMessage = await (
              channel as TextChannel | NewsChannel | ThreadChannel
            ).messages.fetch(messageId);

            if (
              message.channel.type === ChannelType.GuildText ||
              message.channel.type === ChannelType.GuildAnnouncement ||
              message.channel.type === ChannelType.PublicThread ||
              message.channel.type === ChannelType.PrivateThread
            ) {
              await message.reply({
                content: "_ _",
                allowedMentions: { repliedUser: false },
              });
              await targetMessage.forward(message.channel);
            }
          }
        } catch (error) {
          logger.error("Error forwarding message:", error);
        }
      }
    }
  }
}
