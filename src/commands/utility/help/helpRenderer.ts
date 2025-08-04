// src/commands/utility/help/helpRenderer.ts
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  EmbedBuilder,
  GuildMember,
  ApplicationCommand,
} from "discord.js";
import { Command, Services } from "../../../interfaces/Command";
import { capitalize } from "es-toolkit";
import { readFile } from "fs/promises";
import { join } from "path";

interface HelpState {
  lang: "zh-TW" | "en-US";
  category?: string;
  command?: string;
}

// Receives all necessary data, no longer reads files or makes API calls itself
export async function buildHelpReply(
  state: HelpState,
  accessibleCategories: string[],
  commandsByCategory: Map<string, Command[]>,
  appCommands: Map<string, ApplicationCommand>,
  services: Services,
  interaction: any // We only need the member object from the interaction
) {
  const { localizationManager } = services;
  const locales = localizationManager.get("help");
  if (!locales) {
    throw new Error("Help localization not found.");
  }
  const getLang = () => locales[state.lang].interface;

  const member = interaction.member as GuildMember;

  const embed = new EmbedBuilder().setColor(0x5865f2);

  // The rendering logic remains, but the data source has changed
  if (state.command && state.category) {
    const cmd = commandsByCategory
      .get(state.category)
      ?.find((c) => c.data.name === state.command);
    if (cmd) {
      const appCommand = appCommands.get(cmd.data.name);
      const commandId = appCommand ? appCommand.id : "ID_NOT_FOUND";
      const docPath = join(
        process.cwd(),
        "src",
        "commands",
        "help_docs",
        state.lang,
        state.category,
        `${cmd.data.name}.md`
      );
      try {
        // This is the one exception for I/O, as it's for command-specific documentation
        const docContent = await readFile(docPath, "utf-8");
        embed
          .setTitle(`</${cmd.data.name}:${commandId}>`)
          .setDescription(docContent.replace(/^( *[-*] | *\d+\. )/gm, "• "));
      } catch (error) {
        embed
          .setTitle("Error")
          .setDescription("Could not load the documentation for this command.");
      }
    }
  } else if (state.category) {
    embed
      .setTitle(
        getLang().category_title.replace(
          "{category}",
          capitalize(state.category ?? "")
        )
      )
      .setDescription(getLang().select_command_prompt);
  } else {
    embed
      .setTitle(getLang().title)
      .setDescription(getLang().initial_description);
  }

  const components: ActionRowBuilder<any>[] = [];

  if (accessibleCategories.length > 0) {
    const categorySelect = new StringSelectMenuBuilder()
      .setCustomId(`help:category:${state.lang}`)
      .setPlaceholder(getLang().select_placeholder)
      .addOptions(
        accessibleCategories.map((category) => ({
          label: capitalize(category),
          value: category.toLowerCase(),
          default: state.category === category.toLowerCase(),
        }))
      );
    const categoryRow =
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        categorySelect
      );
    components.push(categoryRow);
  } else {
    embed.setDescription(getLang().no_permission);
  }

  if (state.category) {
    const commandOptions = (commandsByCategory.get(state.category) || []).map(
      (cmd) => ({
        label: cmd.data.name,
        value: cmd.data.name,
        default: state.command === cmd.data.name,
      })
    );
    if (commandOptions.length > 0) {
      const commandSelect = new StringSelectMenuBuilder()
        .setCustomId(`help:command:${state.lang}:${state.category}`)
        .setPlaceholder(getLang().select_command_prompt)
        .addOptions(commandOptions);
      const commandRow =
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          commandSelect
        );
      components.push(commandRow);
    }
  }

  const langRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(
        `help:lang:zh-TW:${state.category || "none"}:${state.command || "none"}`
      )
      .setLabel("繁體中文")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(state.lang === "zh-TW"),
    new ButtonBuilder()
      .setCustomId(
        `help:lang:en-US:${state.category || "none"}:${state.command || "none"}`
      )
      .setLabel("English")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(state.lang === "en-US")
  );
  components.push(langRow);

  return { embeds: [embed], components };
}
