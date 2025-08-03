import { StringSelectMenuInteraction } from "discord.js";
import { Databases, Services } from "./Command";

export interface SelectMenu {
  name: string | RegExp;
  execute: (
    interaction: StringSelectMenuInteraction,
    services: Services,
    databases: Databases
  ) => Promise<void>;
}
