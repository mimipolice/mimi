import { MessageFlags } from "discord-api-types/v10";
import {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  GuildMember,
  APISelectMenuOption,
} from "discord.js";
import { HelpService } from "../../../services/HelpService";
import { Services } from "../../../interfaces/Command";

export interface HelpState {
  lang: "zh-TW" | "en-US";
  view?: "home" | "category" | "command";
  category?: string;
  command?: string;
}

export async function buildHelpEmbed(
  state: HelpState,
  helpService: HelpService,
  member: GuildMember | null,
  services: Services
) {
  const embed = new EmbedBuilder().setColor("#0099ff");
  const components: ActionRowBuilder<any>[] = [];

  const accessibleCategories = helpService.getAccessibleCategories(member);

  // View: Home (Default)
  if (!state.view || state.view === "home") {
    embed
      .setTitle("Help Center")
      .setDescription(
        "Welcome! Please select a category to see available commands."
      );
  }

  // View: Category
  if (state.view === "category" && state.category) {
    const commands = helpService.getAccessibleCommandsInCategory(
      state.category,
      member
    );
    embed
      .setTitle(`Category: ${state.category}`)
      .setDescription(
        commands.length > 0
          ? "Select a command below to see its details.\n\n" +
              commands
                .map((cmd) => helpService.getCommandMention(cmd.data.name))
                .join("\n")
          : "You do not have permission to view any commands in this category."
      );
  }

  // View: Command
  if (state.view === "command" && state.category && state.command) {
    const command = helpService
      .getAccessibleCommandsInCategory(state.category, member)
      .find((c) => c.data.name === state.command);

    if (command) {
      const docContent = await helpService.getCommandDoc(command, state.lang);
      const mention = helpService.getCommandMention(command.data.name);
      embed.setTitle(`Command: ${mention}`).setDescription(docContent);
    } else {
      embed
        .setTitle("Error")
        .setDescription(
          "Command not found or you do not have permission to view it."
        )
        .setColor("Red");
    }
  }

  // --- Components ---

  // 1. Category Select Menu
  const categoryOptions: APISelectMenuOption[] = accessibleCategories
    .filter((cat) => cat !== "message")
    .map((cat) => ({
      label: cat.charAt(0).toUpperCase() + cat.slice(1),
      value: cat,
      description: `Commands in the ${cat} category`,
      default: state.category === cat,
    }));

  if (categoryOptions.length > 0) {
    const categorySelect = new StringSelectMenuBuilder()
      .setCustomId("help:category_select")
      .setPlaceholder("Select a category...")
      .setOptions(categoryOptions);
    components.push(new ActionRowBuilder().addComponents(categorySelect));
  }

  // 2. Command Select Menu (only in category or command view)
  if (
    (state.view === "category" || state.view === "command") &&
    state.category
  ) {
    const commands = helpService.getAccessibleCommandsInCategory(
      state.category,
      member
    );
    const commandOptions: APISelectMenuOption[] = commands.map((cmd) => ({
      label: `/${cmd.data.name}`,
      value: cmd.data.name,
      description: ("description" in cmd.data && cmd.data.description) || "",
      default: state.command === cmd.data.name,
    }));

    if (commandOptions.length > 0) {
      const commandSelect = new StringSelectMenuBuilder()
        .setCustomId(`help:command_select:${state.category}`)
        .setPlaceholder("Select a command for details...")
        .setOptions(commandOptions);
      components.push(new ActionRowBuilder().addComponents(commandSelect));
    }
  }

  // 3. Action Buttons
  const homeButton = new ButtonBuilder()
    .setCustomId("help:home")
    .setLabel("Home")
    .setStyle(ButtonStyle.Primary)
    .setDisabled(!state.view || state.view === "home");

  // Example language button - state needs to be fully encoded
  const otherLang = state.lang === "en-US" ? "zh-TW" : "en-US";
  const langButton = new ButtonBuilder()
    .setCustomId(
      `help:lang:${otherLang}:${state.view || "home"}:${state.category || ""}:${
        state.command || ""
      }`
    )
    .setLabel(`Switch to ${otherLang === "en-US" ? "English" : "繁體中文"}`)
    .setStyle(ButtonStyle.Secondary);

  const buttonRow = new ActionRowBuilder().addComponents(
    homeButton,
    langButton
  );
  components.push(buttonRow);

  return { embeds: [embed], components };
}
