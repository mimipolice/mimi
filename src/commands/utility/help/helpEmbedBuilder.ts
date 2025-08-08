import {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  GuildMember,
  APISelectMenuOption,
  AttachmentBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
} from "discord.js";
import { HelpService } from "../../../services/HelpService";
import { Services } from "../../../interfaces/Command";
import { markdownTableToImage } from "../../../utils/markdown-to-image";

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
  services: Services,
  userId: string
) {
  const container = new ContainerBuilder().setAccentColor(0x0099ff);
  const components: ActionRowBuilder<any>[] = [];
  const files: AttachmentBuilder[] = [];

  const accessibleCategories = helpService
    .getAccessibleCategories(member)
    .filter((c) => c !== "user");

  // View: Home (Default)
  if (!state.view || state.view === "home") {
    container.components.push(
      new TextDisplayBuilder().setContent("# Help Center"),
      new TextDisplayBuilder().setContent(
        "Welcome! Please select a category to see available commands."
      )
    );
  }

  // View: Category
  if (state.view === "category" && state.category) {
    let commands = helpService.getAccessibleCommandsInCategory(
      state.category,
      member
    );
    if (state.category === "admin") {
      commands = commands.filter((c) => c.data.name !== "user-info");
    }
    container.components.push(
      new TextDisplayBuilder().setContent(`# Category: ${state.category}`)
    );
    if (commands.length > 0) {
      container.components.push(
        new TextDisplayBuilder().setContent(
          "Select a command below to see its details."
        ),
        new SeparatorBuilder(),
        new TextDisplayBuilder().setContent(
          commands
            .map((cmd) => helpService.getCommandMention(cmd.data.name))
            .join("\n")
        )
      );
    } else {
      container.components.push(
        new TextDisplayBuilder().setContent(
          "You do not have the required permissions to view any commands in this category."
        )
      );
    }
  }

  // View: Command
  if (state.view === "command" && state.category && state.command) {
    const command = helpService
      .getAccessibleCommandsInCategory(state.category, member)
      .filter((c) => c.data.name !== "user-info")
      .find((c) => c.data.name === state.command);

    if (command) {
      const docPath = helpService.getCommandDocPath(command, state.lang);
      let docContent = await helpService.getCommandDoc(command, state.lang);
      const mention = helpService.getCommandMention(command.data.name);

      container.components.push(
        new TextDisplayBuilder().setContent(`# Command: ${mention}`)
      );

      const tableRegex = /\|.*?\r?\n\|.*?\r?\n(?:\|.*?\r?\n)*/g;
      const tables = docContent.match(tableRegex);
      const placeholders: string[] = [];

      if (tables) {
        for (let i = 0; i < tables.length; i++) {
          const tableMarkdown = tables[i];
          const placeholder = `__TABLE_PLACEHOLDER_${i}__`;
          placeholders.push(placeholder);
          docContent = docContent.replace(tableMarkdown, placeholder);

          try {
            const imageBuffer = await markdownTableToImage(
              tableMarkdown,
              docPath,
              i
            );
            const attachmentName = `table-${i}.png`;
            const attachment = new AttachmentBuilder(imageBuffer, {
              name: attachmentName,
            });
            files.push(attachment);
          } catch (error) {
            console.error("Failed to generate table image:", error);
            // If image generation fails, replace placeholder with original table
            docContent = docContent.replace(placeholder, tableMarkdown);
          }
        }
      }

      const contentParts = docContent.split(/(__TABLE_PLACEHOLDER_\d+__)/);
      let imageIndex = 0;

      for (const part of contentParts) {
        if (placeholders.includes(part)) {
          const attachmentName = `table-${imageIndex}.png`;
          if (files.some((f) => f.name === attachmentName)) {
            container.components.push(
              new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder().setURL(
                  `attachment://${attachmentName}`
                )
              )
            );
            imageIndex++;
          }
        } else if (part.trim()) {
          container.components.push(
            new TextDisplayBuilder().setContent(part.trim())
          );
        }
      }
    } else {
      container.components.push(
        new TextDisplayBuilder().setContent("# Error"),
        new TextDisplayBuilder().setContent(
          "Command not found or you do not have the required permissions to view it."
        )
      );
      container.setAccentColor(0xff0000); // Red
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
      .setCustomId(`help:category_select:${userId}`)
      .setPlaceholder("Select a category...")
      .setOptions(categoryOptions);
    components.push(new ActionRowBuilder().addComponents(categorySelect));
  }

  // 2. Command Select Menu (only in category or command view)
  if (
    (state.view === "category" || state.view === "command") &&
    state.category
  ) {
    let commands = helpService.getAccessibleCommandsInCategory(
      state.category,
      member
    );
    if (state.category === "admin") {
      commands = commands.filter((c) => c.data.name !== "user-info");
    }
    const commandOptions: APISelectMenuOption[] = commands.map((cmd) => ({
      label: `/${cmd.data.name}`,
      value: cmd.data.name,
      description: ("description" in cmd.data && cmd.data.description) || "",
      default: state.command === cmd.data.name,
    }));

    if (commandOptions.length > 0) {
      const commandSelect = new StringSelectMenuBuilder()
        .setCustomId(`help:command_select:${state.category}:${userId}`)
        .setPlaceholder("Select a command for details...")
        .setOptions(commandOptions);
      components.push(new ActionRowBuilder().addComponents(commandSelect));
    }
  }

  // 3. Action Buttons
  const homeButton = new ButtonBuilder()
    .setCustomId(`help:home:${userId}`)
    .setLabel("Home")
    .setStyle(ButtonStyle.Primary)
    .setDisabled(!state.view || state.view === "home");

  // Example language button - state needs to be fully encoded
  const otherLang = state.lang === "en-US" ? "zh-TW" : "en-US";
  const langButton = new ButtonBuilder()
    .setCustomId(
      `help:lang:${otherLang}:${state.view || "home"}:${state.category || ""}:${
        state.command || ""
      }:${userId}`
    )
    .setLabel(`Switch to ${otherLang === "en-US" ? "English" : "繁體中文"}`)
    .setStyle(ButtonStyle.Secondary);

  const buttonRow = new ActionRowBuilder().addComponents(
    homeButton,
    langButton
  );
  components.push(buttonRow);

  return { container, components, files };
}
