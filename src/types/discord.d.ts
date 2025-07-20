import { Collection } from "discord.js";
import { Command } from "../interfaces/Command";

declare module "discord.js" {
  export interface Client {
    commands: Collection<string, Command>;
    commandCategories: Collection<string, Collection<string, Command>>;
    buttons: Collection<string, any>;
    modals: Collection<string, any>;
    selectMenus: Collection<string, any>;
  }
}
