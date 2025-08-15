import { Message } from "discord.js";
import { Services } from "./Command";

export interface MessageCommand {
  name: string;
  aliases?: string[];
  execute: (
    message: Message,
    args: string[],
    services: Services
  ) => Promise<void>;
}
