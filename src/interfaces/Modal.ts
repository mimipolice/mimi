import { ModalSubmitInteraction } from 'discord.js';
import { TicketManager } from '../services/TicketManager';

export interface Modal {
  name: string | RegExp;
  execute: (
    interaction: ModalSubmitInteraction,
    ticketManager?: TicketManager,
  ) => Promise<void>;
}
