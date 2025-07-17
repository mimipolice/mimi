import { StringSelectMenuInteraction } from 'discord.js';

export interface SelectMenu {
  name: string | RegExp;
  execute: (interaction: StringSelectMenuInteraction) => Promise<void>;
}
