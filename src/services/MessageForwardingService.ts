import {
  Message,
  Client,
  TextChannel,
  NewsChannel,
  ThreadChannel,
  ChannelType,
  MessageReaction,
  User,
} from "discord.js";
import logger from "../utils/logger";
import { getSolution } from "../repositories/forum.repository";
import { mimiDLCDb } from "../shared/database";

export class MessageForwardingService {
  private client: Client;
  private forwardedMessageGroups: Map<
    string,
    { authorId: string; groupIds: string[] }
  > = new Map();
  private userCooldowns: Map<string, number> = new Map();
  private readonly cooldownTime = 5000; // 5 seconds

  constructor(client: Client) {
    this.client = client;
  }

  public async handleMessageForwarding(message: Message): Promise<void> {
    if (!message.guild || !message.author) return;

    const now = Date.now();
    const lastUsed = this.userCooldowns.get(message.author.id);
    if (lastUsed && now - lastUsed < this.cooldownTime) {
      return;
    }

    const messageLinkRegex =
      /https:\/\/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/g;
    const matches = message.content.matchAll(messageLinkRegex);

    const targets: { channelId: string; messageId: string }[] = [];
    for (const match of matches) {
      const [_, guildId, channelId, messageId] = match;
      if (guildId === message.guild.id) {
        targets.push({ channelId, messageId });
      }
    }

    if (targets.length === 0) return;

    if (
      message.channel.type !== ChannelType.GuildText &&
      message.channel.type !== ChannelType.GuildAnnouncement &&
      message.channel.type !== ChannelType.PublicThread &&
      message.channel.type !== ChannelType.PrivateThread
    ) {
      return;
    }

    try {
      const replyMessage = await message.reply({
        content: "_ _",
        allowedMentions: { repliedUser: false },
      });

      const forwardedMessages: Message[] = [];
      for (const { channelId, messageId } of targets) {
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

            if (channel.isThread()) {
              const solution = await getSolution(mimiDLCDb, channel.id);
              if (solution) {
                const solutionMessage = await channel.messages.fetch(
                  solution.message_id
                );
                await solutionMessage.forward(message.channel);
                await channel.send(
                  `-# User ${message.author.username} mentioned this post in ${message.url}`
                );
              }
            }

            const newForwardedMessage = await targetMessage.forward(
              message.channel
            );
            forwardedMessages.push(newForwardedMessage);
          }
        } catch (error) {
          logger.error(
            `Error forwarding message link: https://discord.com/channels/${message.guild.id}/${channelId}/${messageId}`,
            error
          );
        }
      }

      if (forwardedMessages.length > 0) {
        const groupIds = [
          replyMessage.id,
          ...forwardedMessages.map((m) => m.id),
        ];
        const groupData = {
          authorId: message.author.id,
          groupIds,
        };
        for (const id of groupIds) {
          this.forwardedMessageGroups.set(id, groupData);
        }

        setTimeout(() => {
          for (const id of groupIds) {
            this.forwardedMessageGroups.delete(id);
          }
        }, 24 * 60 * 60 * 1000); // 24 hours
      }
      this.userCooldowns.set(message.author.id, now);
    } catch (error) {
      logger.error(
        "Error sending initial reply for message forwarding:",
        error
      );
    }
  }
}
