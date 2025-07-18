import { SlashCommandBuilder, ChatInputCommandInteraction, Client, SlashCommandSubcommandsOnlyBuilder, AutocompleteInteraction } from 'discord.js';
import { SettingsManager } from '../services/SettingsManager';
import { TicketManager } from '../services/TicketManager';
import { Kysely } from 'kysely';

export interface Command {
  data: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder;
  execute(
    interaction: ChatInputCommandInteraction,
    client: Client,
    settingsManager: SettingsManager,
    ticketManager: TicketManager,
    gachaDb: Kysely<any>,
    ticketDb: Kysely<any>
  ): Promise<void>;
  autocomplete?(
    interaction: AutocompleteInteraction,
    gachaDb: Kysely<any>,
    ticketDb: Kysely<any>
  ): Promise<void>;
}
