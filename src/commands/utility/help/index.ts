// src/commands/utility/help/index.ts
import {
  ChatInputCommandInteraction,
  Client,
  Collection,
  GuildMember,
  SlashCommandBuilder,
  PermissionFlagsBits,
} from "discord.js";
import { Command, Services } from "../../../interfaces/Command";
import { buildHelpReply } from "./helpRenderer";
import fs from "fs";
import path from "path";

// Helper function to get all commands grouped by category
export function getCommandsByCategory(client: Client): Map<string, Command[]> {
  const commandsByCategory = new Map<string, Command[]>();
  const commandsPath = path.join(__dirname, "..", "..");
  const commandFolders = fs
    .readdirSync(commandsPath)
    .filter((file) => fs.statSync(path.join(commandsPath, file)).isDirectory());

  for (const category of commandFolders) {
    const categoryPath = path.join(commandsPath, category);
    const commandSubFolders = fs
      .readdirSync(categoryPath)
      .filter((file) =>
        fs.statSync(path.join(categoryPath, file)).isDirectory()
      );

    const categoryCommands: Command[] = [];
    for (const commandName of commandSubFolders) {
      const command = client.commands.get(commandName);
      if (command) {
        categoryCommands.push(command);
      }
    }

    if (categoryCommands.length > 0) {
      commandsByCategory.set(category, categoryCommands);
    }
  }
  return commandsByCategory;
}

// Helper function to get categories accessible to a specific member
export function getAccessibleCategories(
  client: Client,
  member: GuildMember
): string[] {
  const categories = Array.from(getCommandsByCategory(client).keys());
  // Example of a simple permission check, you may need to adjust this
  if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
    return categories.filter((c) => c !== "admin");
  }
  return categories;
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Displays a list of available commands."),
  async execute(
    interaction: ChatInputCommandInteraction,
    client: Client,
    services: Services
  ) {
    await interaction.deferReply({ ephemeral: true }); // **Immediately acknowledge the API**

    const initialState = { lang: "zh-TW" as const };

    // --- Prepare Data ---
    const commandsByCategory = getCommandsByCategory(client);
    const accessibleCategories = getAccessibleCategories(
      client,
      interaction.member as GuildMember
    );
    const appCommands = await client.application!.commands.fetch();

    const replyPayload = await buildHelpReply(
      initialState,
      accessibleCategories,
      commandsByCategory,
      appCommands,
      services,
      interaction
    );

    await interaction.editReply(replyPayload);
  },
};
