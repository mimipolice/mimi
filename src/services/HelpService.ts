import {
  Client,
  Collection,
  GuildMember,
  ApplicationCommand,
} from "discord.js";
import { Command } from "../interfaces/Command";
import { readFile } from "fs/promises";
import { join, sep } from "path";

export class HelpService {
  private client: Client;
  private appCommands: Collection<string, ApplicationCommand> =
    new Collection();

  constructor(client: Client) {
    this.client = client;
  }

  public async initialize(): Promise<void> {
    // Cache all global application commands on startup
    if (this.client.application) {
      this.appCommands = await this.client.application.commands.fetch();
    }
  }

  public getCommandsByCategory(): Map<string, Command[]> {
    const commandCategories = this.client.commandCategories as Collection<
      string,
      Collection<string, Command>
    >;
    const categories = new Map<string, Command[]>();
    for (const [categoryName, commands] of commandCategories.entries()) {
      categories.set(categoryName, [...commands.values()]);
    }
    return categories;
  }

  public getAccessibleCategories(member: GuildMember): string[] {
    const commandsByCategory = this.getCommandsByCategory();
    const accessibleCategories: string[] = [];
    for (const [category, commands] of commandsByCategory.entries()) {
      if (commands.some((cmd) => this.hasPermission(member, cmd))) {
        accessibleCategories.push(category);
      }
    }
    return accessibleCategories;
  }

  public getAccessibleCommandsInCategory(
    category: string,
    member: GuildMember
  ): Command[] {
    const commandsByCategory = this.getCommandsByCategory();
    return (commandsByCategory.get(category) || []).filter((cmd) =>
      this.hasPermission(member, cmd)
    );
  }

  public async getCommandDoc(
    command: Command,
    lang: "zh-TW" | "en-US"
  ): Promise<string> {
    // Dynamically get the category from the file path
    const category = command.filePath?.split(sep).slice(-3, -2)[0];
    if (!category)
      return "Documentation not found: Missing category information.";

    const docPath = join(
      process.cwd(),
      "src/commands/help_docs",
      lang,
      category,
      `${command.data.name}.md`
    );
    try {
      return await readFile(docPath, "utf-8");
    } catch (error) {
      return `Documentation for '${command.data.name}' in this language is not available.`;
    }
  }

  public getCommandMention(commandName: string): string {
    const appCommand = this.appCommands.find((cmd) => cmd.name === commandName);
    return appCommand
      ? `</${commandName}:${appCommand.id}>`
      : `/${commandName}`;
  }

  private hasPermission(member: GuildMember, command: Command): boolean {
    const permissions = command.data.default_member_permissions;
    if (!permissions) return true; // If no permissions are specified, command is public
    return member.permissions.has(BigInt(permissions));
  }
}
