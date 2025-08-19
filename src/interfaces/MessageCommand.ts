import { Message } from "discord.js";
import { Services, Databases } from "./Command";

export interface MessageCommand {
  name: string;
  aliases?: string[];
  execute: (
    message: Message,
    args: string[],
    services: Services,
    databases: Databases
  ) => Promise<void>;
}
