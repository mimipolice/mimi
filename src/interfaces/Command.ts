import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  SlashCommandSubcommandsOnlyBuilder,
  AutocompleteInteraction,
  ContextMenuCommandBuilder,
  UserContextMenuCommandInteraction,
  MessageContextMenuCommandInteraction,
} from "discord.js";
import { SettingsManager } from "../services/SettingsManager";
import { TicketManager } from "../services/TicketManager";
import { Kysely } from "kysely";

export interface Command {
  data:
    | SlashCommandBuilder
    | SlashCommandSubcommandsOnlyBuilder
    | ContextMenuCommandBuilder;
  detailedHelpPath?: string;
  restrictedRoles?: string[];
  channelPermissions?: bigint[];
  execute(
    interaction:
      | ChatInputCommandInteraction
      | UserContextMenuCommandInteraction
      | MessageContextMenuCommandInteraction,
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
