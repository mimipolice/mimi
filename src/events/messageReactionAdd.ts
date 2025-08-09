import { Events, MessageReaction, User, Client } from "discord.js";
import { Services, Databases } from "../interfaces/Command";

export const name = Events.MessageReactionAdd;
export const once = false;

export async function execute(
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
}
