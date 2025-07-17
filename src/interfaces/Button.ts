import { ButtonInteraction, Client } from 'discord.js';
import { SettingsManager } from '../services/SettingsManager';
import { TicketManager } from '../services/TicketManager';

export interface Button {
  name: string | RegExp;
  execute: (
    interaction: ButtonInteraction,
    client: Client,
    settingsManager?: SettingsManager,
    ticketManager?: TicketManager,
  ) => Promise<void>;
}
