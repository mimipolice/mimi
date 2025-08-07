import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  SlashCommandSubcommandsOnlyBuilder,
  AutocompleteInteraction,
  ContextMenuCommandBuilder,
  UserContextMenuCommandInteraction,
  MessageContextMenuCommandInteraction,
  SlashCommandOptionsOnlyBuilder,
} from "discord.js";
import { SettingsManager } from "../services/SettingsManager";
import { TicketManager } from "../services/TicketManager";
import { LocalizationManager } from "../services/LocalizationManager";
import { HelpService } from "../services/HelpService";
import { ForumService } from "../services/ForumService";
import { Kysely } from "kysely";

export interface Services {
  settingsManager: SettingsManager;
  ticketManager: TicketManager;
  localizationManager: LocalizationManager;
  helpService: HelpService;
  forumService: ForumService;
}

export interface Databases {
  gachaDb: Kysely<any>;
  ticketDb: Kysely<any>;
}

export interface Command {
  data:
    | SlashCommandBuilder
    | SlashCommandSubcommandsOnlyBuilder
    | ContextMenuCommandBuilder
    | SlashCommandOptionsOnlyBuilder;
  detailedHelpPath?: string;
  filePath?: string;
  guildOnly?: boolean;
  restrictedRoles?: string[];
  channelPermissions?: bigint[];
  execute(
    interaction:
      | ChatInputCommandInteraction
      | UserContextMenuCommandInteraction
      | MessageContextMenuCommandInteraction,
    client: Client,
    services: Services,
    databases: Databases
  ): Promise<void>;
  autocomplete?(
    interaction: AutocompleteInteraction,
    gachaDb: Kysely<any>,
    ticketDb: Kysely<any>
  ): Promise<void>;
}
