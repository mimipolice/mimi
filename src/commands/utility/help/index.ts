import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  ContainerBuilder,
  MessageFlags,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  GuildMember,
  Collection,
  ApplicationCommand,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  ActionRow,
  MessageActionRowComponent,
  MessageActionRowComponentBuilder,
} from "discord.js";
import { Command } from "../../../interfaces/Command";
import { capitalize } from "lodash";
import { readFile } from "fs/promises";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Gets all commands grouped by their category.
 * @param client The discord client.
 * @returns A map of category names to an array of commands.
 */
function getCommandsByCategory(client: Client): Map<string, Command[]> {
  const categories = new Map<string, Command[]>();
  const commandCategories = client.commandCategories as Collection<
    string,
    Collection<string, Command>
  >;

  for (const [categoryName, commands] of commandCategories.entries()) {
    categories.set(categoryName, [...commands.values()]);
  }
  return categories;
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Displays a list of available commands."),
  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    await interaction.deferReply(); //           fetchReply: true,    flags: MessageFlags.Ephemeral,

    const locales = {
      "en-US": JSON.parse(
        readFileSync(join(__dirname, "locales", "en-US.json"), "utf-8")
      ).interface,
      "zh-TW": JSON.parse(
        readFileSync(join(__dirname, "locales", "zh-TW.json"), "utf-8")
      ).interface,
    };

    let currentLang = "zh-TW";
    let selectedCategory: string | null = null;

    const getLang = () => locales[currentLang as keyof typeof locales];

    const member = interaction.member as GuildMember;
    if (!member) {
      await interaction.editReply(
        "Could not retrieve your member information."
      );
      return;
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
      const noPermsContainer = new ContainerBuilder()
        .setAccentColor(0xed4245)
        .addTextDisplayComponents((text) =>
          text.setContent(getLang().no_permission)
        );
      await interaction.editReply({
        components: [noPermsContainer],
        flags: MessageFlags.IsComponentsV2,
      });
      return;
    }

    const appCommands = await client.application?.commands.fetch();
    if (!appCommands) {
      await interaction.editReply("Could not fetch application commands.");
      return;
    }

    const updateReply = async (
      i?: ChatInputCommandInteraction | any,
      commandName?: string
    ) => {
      const interactionOrUpdate = i || interaction;

      // 1. Build Container
      const container = new ContainerBuilder().setAccentColor(0x5865f2);

      if (commandName && selectedCategory) {
        const cmd = commandsByCategory
          .get(selectedCategory)
          ?.find((c) => c.data.name === commandName);
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
            currentLang,
            selectedCategory,
            `${cmd.data.name}.md`
          );
          try {
            const docContent = await readFile(docPath, "utf-8");
            const commandTitle = `</${cmd.data.name}:${commandId}>`;
            const processedContent = docContent.replace(
              /^( *[-*] | *\d+\. )/gm,
              "• "
            );
            container.addTextDisplayComponents(
              (text) => text.setContent(commandTitle),
              (text) => text.setContent(processedContent)
            );
          } catch (error) {
            const langName = currentLang === "en-US" ? "英文" : "繁體中文";
            const content =
              (error as NodeJS.ErrnoException).code === "ENOENT"
                ? `此指令的${langName}說明文件不存在。`
                : "讀取說明文件時發生錯誤。";
            container.addTextDisplayComponents((text) =>
              text.setContent(content)
            );
          }
        }
      } else if (selectedCategory) {
        container.addTextDisplayComponents((text) =>
          text.setContent(
            `## ${getLang().category_title.replace(
              "{category}",
              capitalize(selectedCategory ?? "")
            )}`
          )
        );
        container.addTextDisplayComponents((text) =>
          text.setContent(getLang().select_command_prompt)
        );
      } else {
        container.addTextDisplayComponents(
          (text) => text.setContent(`## ${getLang().title}`),
          (text) => text.setContent(getLang().initial_description)
        );
      }

      // 2. Build Components
      const categorySelect = new StringSelectMenuBuilder()
        .setCustomId("help-category-select")
        .setPlaceholder(getLang().select_placeholder)
        .addOptions(
          accessibleCategories.map((category) => ({
            label: capitalize(category),
            value: category.toLowerCase(),
            default: selectedCategory === category.toLowerCase(),
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

      if (selectedCategory) {
        const accessibleCommands = (
          commandsByCategory.get(selectedCategory) || []
        ).filter((cmd) => {
          const permissions = cmd.data.default_member_permissions;
          if (!permissions) return true;
          return member.permissions.has(BigInt(permissions));
        });

        if (accessibleCommands.length > 0) {
          const commandSelect = new StringSelectMenuBuilder()
            .setCustomId("help-command-select")
            .setPlaceholder(getLang().select_placeholder)
            .addOptions(
              accessibleCommands.map((cmd) => ({
                label: cmd.data.name,
                value: cmd.data.name,
                default: commandName === cmd.data.name,
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
          .setCustomId("help-lang-zh-TW")
          .setLabel("繁體中文")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(currentLang === "zh-TW"),
        new ButtonBuilder()
          .setCustomId("help-lang-en-US")
          .setLabel("English")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(currentLang === "en-US")
      );
      components.push(langRow);

      await interactionOrUpdate.editReply({
        components: [container, ...components],
        flags: MessageFlags.IsComponentsV2,
      });
    };

    await updateReply();
    const reply = await interaction.fetchReply();

    const collector = reply.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id,
      time: 120000, // 2 minutes
    });

    collector.on("collect", async (i) => {
      await i.deferUpdate();
      let command: string | undefined = undefined;

      if (i.isButton()) {
        currentLang = i.customId.substring("help-lang-".length);
        selectedCategory = null; // Reset category on lang change
      } else if (i.isStringSelectMenu()) {
        if (i.customId === "help-category-select") {
          selectedCategory = i.values[0];
        } else if (i.customId === "help-command-select") {
          command = i.values[0];
        }
      }
      await updateReply(i, command);
    });

    collector.on("end", async (collected, reason) => {
      if (reason === "time") {
        const translations = getLang();
        const expiredContainer = new ContainerBuilder()
          .setAccentColor(0xed4245)
          .addTextDisplayComponents(
            (text) => text.setContent(`## ${translations.expired_title}`),
            (text) => text.setContent(translations.expired_description)
          );

        const finalMessage =
          collected.last()?.message ?? (await interaction.fetchReply());

        const disabledComponents = finalMessage.components
          .filter(
            (c): c is ActionRow<MessageActionRowComponent> =>
              c.type === ComponentType.ActionRow
          )
          .map((row) => {
            const newRow =
              new ActionRowBuilder<MessageActionRowComponentBuilder>();
            const innerComponents = row.components
              .map((comp): ButtonBuilder | StringSelectMenuBuilder | null => {
                switch (comp.type) {
                  case ComponentType.StringSelect:
                    return StringSelectMenuBuilder.from(comp).setDisabled(true);
                  case ComponentType.Button:
                    return ButtonBuilder.from(comp).setDisabled(true);
                  default:
                    return null;
                }
              })
              .filter(
                (c): c is ButtonBuilder | StringSelectMenuBuilder => c !== null
              );

            if (innerComponents.length > 0) {
              newRow.addComponents(innerComponents);
            }
            return newRow;
          });

        try {
          await interaction.editReply({
            components: [expiredContainer, ...disabledComponents],
            flags: MessageFlags.IsComponentsV2,
          });
        } catch (error) {
          // Ignore errors, e.g., if the message was deleted.
        }
      }
    });
  },
};
