import { ModalSubmitInteraction } from "discord.js";
import { Databases, Services } from "./Command";

export interface Modal {
  name: string | RegExp;
  execute: (
    interaction: ModalSubmitInteraction,
    services: Services,
    databases: Databases
  ) => Promise<void>;
}
