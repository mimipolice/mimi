// src/commands/utility/help/helpRenderer.ts
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  MessageFlags,
  StringSelectMenuBuilder,
  EmbedBuilder,
  GuildMember,
  Collection,
  ApplicationCommand,
} from "discord.js";
import { Command, Services } from "../../../interfaces/Command";
import { capitalize } from "es-toolkit";
import { readFile } from "fs/promises";
import { readFileSync } from "fs";
import { join } from "path";

interface HelpState {
  lang: "zh-TW" | "en-US";
  category?: string;
  command?: string;
}

function getCommandsByCategory(client: Client): Map<string, Command[]> {
  const categories = new Map<string, Command[]>();
  const commandCategories = (client as any).commandCategories as Collection<
    string,
    Collection<string, Command>
  >;

  for (const [categoryName, commands] of commandCategories.entries()) {
    categories.set(categoryName, [...commands.values()]);
  }
  return categories;
}

// This function receives the parsed state and returns a complete MessagePayload
export async function buildHelpReply(
  state: HelpState,
  client: Client,
  services: Services,
  interaction: any
) {
  const locales = {
    "en-US": JSON.parse(
      readFileSync(join(__dirname, "..", "locales", "en-US.json"), "utf-8")
    ).interface,
    "zh-TW": JSON.parse(
      readFileSync(join(__dirname, "..", "locales", "zh-TW.json"), "utf-8")
    ).interface,
  };

  const getLang = () => locales[state.lang as keyof typeof locales];

  const member = interaction.member as GuildMember;
  if (!member) {
    return {
      content: "Could not retrieve your member information.",
      embeds: [],
      components: [],
      ephemeral: true,
    };
  }

  const commandsByCategory = getCommandsByCategory(client);
  const accessibleCategories: string[] = [];

  for (const [category, commands] of commandsByCategory.entries()) {
    const hasPermission = commands.some((cmd) => {
      const permissions = cmd.data.default_member_permissions;
      if (!permissions) return true;
      return member.permissions.has(BigInt(permissions));
    });
    if (hasPermission) {
      accessibleCategories.push(category);
    }
  }

  if (accessibleCategories.length === 0) {
    const noPermsEmbed = new EmbedBuilder()
      .setColor(0xed4245)
      .setDescription(getLang().no_permission);
    return {
      embeds: [noPermsEmbed.toJSON()],
      components: [],
      ephemeral: true,
    };
  }

  const appCommands = await client.application?.commands.fetch();
  if (!appCommands) {
    return {
      content: "Could not fetch application commands.",
      embeds: [],
      components: [],
      ephemeral: true,
    };
  }

  // 1. Create Embed/Container
  const embed = new EmbedBuilder().setColor(0x5865f2);
  if (state.command && state.category) {
    const cmd = commandsByCategory
      .get(state.category)
      ?.find((c) => c.data.name === state.command);
    if (cmd) {
      const appCommand = appCommands.find(
        (ac: ApplicationCommand) => ac.name === cmd.data.name
      );
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
        const docContent = await readFile(docPath, "utf-8");
        const commandTitle = `</${cmd.data.name}:${commandId}>`;
        const processedContent = docContent.replace(
          /^( *[-*] | *\d+\. )/gm,
          "• "
        );
        embed.setTitle(commandTitle).setDescription(processedContent);
      } catch (error) {
        const langName =
          state.lang === "en-US" ? "English" : "Traditional Chinese";
        const content =
          (error as NodeJS.ErrnoException).code === "ENOENT"
            ? `The help document for this command in ${langName} does not exist.`
            : "An error occurred while reading the help document.";
        embed.setDescription(content);
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

  // 2. Create Components, and encode the *next state* into the customId
  const categorySelect = new StringSelectMenuBuilder()
    .setCustomId(`help:category:${state.lang}`) // customId now includes the language
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

  const components: (
    | ActionRowBuilder<StringSelectMenuBuilder>
    | ActionRowBuilder<ButtonBuilder>
  )[] = [categoryRow];

  if (state.category) {
    const accessibleCommands = (
      commandsByCategory.get(state.category) || []
    ).filter((cmd) => {
      const permissions = cmd.data.default_member_permissions;
      if (!permissions) return true;
      return member.permissions.has(BigInt(permissions));
    });

    if (accessibleCommands.length > 0) {
      const commandSelect = new StringSelectMenuBuilder()
        .setCustomId(`help:command:${state.lang}:${state.category}`)
        .setPlaceholder(getLang().select_placeholder)
        .addOptions(
          accessibleCommands.map((cmd) => ({
            label: cmd.data.name,
            value: cmd.data.name,
            default: state.command === cmd.data.name,
          }))
        );
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
        `help:lang:zh-TW:${state.category || ""}:${state.command || ""}`
      ) // Include current state
      .setLabel("繁體中文")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(state.lang === "zh-TW"),
    new ButtonBuilder()
      .setCustomId(
        `help:lang:en-US:${state.category || ""}:${state.command || ""}`
      ) // Include current state
      .setLabel("English")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(state.lang === "en-US")
  );
  components.push(langRow);

  return {
    embeds: [embed.toJSON()],
    components: components,
    ephemeral: true,
  };
}
