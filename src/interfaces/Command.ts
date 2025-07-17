import { SlashCommandBuilder, ChatInputCommandInteraction, Client, SlashCommandSubcommandsOnlyBuilder, AutocompleteInteraction } from 'discord.js';
import { SettingsManager } from '../services/SettingsManager';
import { TicketManager } from '../services/TicketManager';
import { Pool } from 'pg';

export interface Command {
  data: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder;
  execute(
    interaction: ChatInputCommandInteraction,
    client: Client,
    settingsManager: SettingsManager,
    ticketManager: TicketManager,
    db: Pool
  ): Promise<void>;
  autocomplete?(
    interaction: AutocompleteInteraction,
    db: Pool
  ): Promise<void>;
}
