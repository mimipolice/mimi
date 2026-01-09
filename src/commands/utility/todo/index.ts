import {
  SlashCommandBuilder,
  CommandInteraction,
  AutocompleteInteraction,
  Locale,
  Client,
} from "discord.js";
import { mimiDLCDb } from "../../../shared/database";
import {
  addTodo,
  removeTodo,
  getTodos,
  clearTodos,
} from "../../../repositories/admin.repository";
import { MessageFlags } from "discord-api-types/v10";
import { getLocalizations } from "../../../utils/localization";
import logger from "../../../utils/logger";

import { Command, Databases, Services } from "../../../interfaces/Command";

export default {
  data: new SlashCommandBuilder()
    .setName("todo")
    .setDescription("Manage your todo list.")
    .setNameLocalizations({
      [Locale.ChineseTW]: "待辦事項",
    })
    .setDescriptionLocalizations({
      [Locale.ChineseTW]: "管理您的待辦事項清單。",
    })
    .addSubcommand((subcommand) =>
      subcommand
        .setName("add")
        .setDescription("Add an item to your todo list.")
        .setNameLocalizations({
          [Locale.ChineseTW]: "新增",
        })
        .setDescriptionLocalizations({
          [Locale.ChineseTW]: "將項目新增至您的待辦事項清單。",
        })
        .addStringOption((option) =>
          option
            .setName("item")
            .setDescription("The item to add.")
            .setNameLocalizations({
              [Locale.ChineseTW]: "項目",
            })
            .setDescriptionLocalizations({
              [Locale.ChineseTW]: "要新增的項目。",
            })
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("remove")
        .setDescription("Remove an item from your todo list.")
        .setNameLocalizations({
          [Locale.ChineseTW]: "移除",
        })
        .setDescriptionLocalizations({
          [Locale.ChineseTW]: "從您的待辦事項清單中移除項目。",
        })
        .addIntegerOption((option) =>
          option
            .setName("id")
            .setDescription("The ID of the item to remove.")
            .setNameLocalizations({
              [Locale.ChineseTW]: "id",
            })
            .setDescriptionLocalizations({
              [Locale.ChineseTW]: "要移除的項目id。",
            })
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("list")
        .setDescription("List all items in your todo list.")
        .setNameLocalizations({
          [Locale.ChineseTW]: "列表",
        })
        .setDescriptionLocalizations({
          [Locale.ChineseTW]: "列出您待辦事項清單中的所有項目。",
        })
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("clear")
        .setDescription("Clear your todo list.")
        .setNameLocalizations({
          [Locale.ChineseTW]: "清除",
        })
        .setDescriptionLocalizations({
          [Locale.ChineseTW]: "清除您的待辦事項清單。",
        })
    ),

  async autocomplete(interaction: AutocompleteInteraction) {
    const focusedValue = interaction.options.getFocused();
    const todos = await getTodos(mimiDLCDb, interaction.user.id);
    const choices = todos
      .filter((todo) =>
        todo.item.toLowerCase().includes(focusedValue.toLowerCase())
      )
      .map((todo) => ({
        name: `#${todo.id}: ${todo.item}`,
        value: todo.id,
      }));
    await interaction.respond(choices.slice(0, 25));
  },

  async execute(
    interaction: CommandInteraction,
    _client: Client,
    { localizationManager }: Services,
    { ticketDb: mimiDLCDb }: Databases
  ) {
    if (!interaction.isChatInputCommand()) return;

    const translations = getLocalizations(localizationManager, "todo");
    const t = translations[interaction.locale] || translations["en-US"];
    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    try {
      // Only defer if not already deferred or replied
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      }

      if (subcommand === "add") {
        const item = interaction.options.getString(
          t.subcommands.add.options.item.name,
          true
        );
        await addTodo(mimiDLCDb, userId, item);
        await interaction.editReply(
          t.subcommands.add.responses.success.replace("{{item}}", item)
        );
      } else if (subcommand === "remove") {
        const id = interaction.options.getInteger(
          t.subcommands.remove.options.id.name,
          true
        );
        const removedCount = await removeTodo(mimiDLCDb, id, userId);
        if (removedCount > 0) {
          await interaction.editReply(
            t.subcommands.remove.responses.success.replace(
              "{{id}}",
              id.toString()
            )
          );
        } else {
          await interaction.editReply(
            t.subcommands.remove.responses.not_found.replace(
              "{{id}}",
              id.toString()
            )
          );
        }
      } else if (subcommand === "list") {
        const todos = await getTodos(mimiDLCDb, userId);
        if (todos.length === 0) {
          await interaction.editReply(t.subcommands.list.responses.empty);
          return;
        }
        const list = todos
          .map((todo) => `**${todo.id}**: ${todo.item}`)
          .join("\n");
        await interaction.editReply(
          `${t.subcommands.list.responses.title}\n${list}`
        );
      } else if (subcommand === "clear") {
        await clearTodos(mimiDLCDb, userId);
        await interaction.editReply(t.subcommands.clear.responses.success);
      }
    } catch (error) {
      logger.error(`Todo command error (by <@${interaction.user.id}> / ${interaction.user.id}):`, error);
      await interaction.editReply(t.general_error);
    }
  },
};
