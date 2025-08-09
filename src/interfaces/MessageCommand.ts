import { Message } from "discord.js";

export interface MessageCommand {
  name: string;
  aliases?: string[];
  execute: (message: Message, args: string[]) => Promise<void>;
}
