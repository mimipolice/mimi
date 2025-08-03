import { ButtonInteraction, Client } from "discord.js";
import { Databases, Services } from "./Command";

export interface Button {
  name: string | RegExp;
  execute: (
    interaction: ButtonInteraction,
    client: Client,
    services: Services,
    databases: Databases
  ) => Promise<void>;
}
