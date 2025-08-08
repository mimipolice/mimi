import { Events, MessageReaction, User } from "discord.js";
import { Client } from "discord.js";
import { Services, Databases } from "../interfaces/Command";

module.exports = {
  name: Events.MessageReactionAdd,
  once: false,
  async execute(
    reaction: MessageReaction,
    user: User,
    client: Client,
    services: Services,
    databases: Databases
  ) {
    if (user.bot) return;

    // Handle partial reaction data
    if (reaction.partial) {
      try {
        await reaction.fetch();
      } catch (error) {
        console.error("Something went wrong when fetching the message:", error);
        return;
      }
    }

    await services.messageForwardingService.handleReaction(reaction, user);
  },
};
