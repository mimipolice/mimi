import {
  SlashCommandBuilder,
  CommandInteraction,
  AutocompleteInteraction,
  Locale,
} from "discord.js";
import { mimiDLCDb } from "../../../shared/database";
import {
  addTodo,
  removeTodo,
  getTodos,
  clearTodos,
} from "../../../shared/database/queries";
import { MessageFlags } from "discord-api-types/v10";
import { getLocalizations } from "../../../utils/localization";
import logger from "../../../utils/logger";

const translations = getLocalizations("todo");

export default {
  data: new SlashCommandBuilder()
    .setName(translations["en-US"].name)
    .setDescription(translations["en-US"].description)
    .setNameLocalizations({
      [Locale.ChineseTW]: translations["zh-TW"].name,
    })
    .setDescriptionLocalizations({
      [Locale.ChineseTW]: translations["zh-TW"].description,
    })
    .addSubcommand((subcommand) =>
      subcommand
        .setName(translations["en-US"].subcommands.add.name)
        .setDescription(translations["en-US"].subcommands.add.description)
        .setNameLocalizations({
          [Locale.ChineseTW]: translations["zh-TW"].subcommands.add.name,
        })
        .setDescriptionLocalizations({
          [Locale.ChineseTW]: translations["zh-TW"].subcommands.add.description,
        })
        .addStringOption((option) =>
          option
            .setName(translations["en-US"].subcommands.add.options.item.name)
            .setDescription(
              translations["en-US"].subcommands.add.options.item.description
            )
            .setNameLocalizations({
              [Locale.ChineseTW]:
                translations["zh-TW"].subcommands.add.options.item.name,
            })
            .setDescriptionLocalizations({
              [Locale.ChineseTW]:
                translations["zh-TW"].subcommands.add.options.item.description,
            })
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName(translations["en-US"].subcommands.remove.name)
        .setDescription(translations["en-US"].subcommands.remove.description)
        .setNameLocalizations({
          [Locale.ChineseTW]: translations["zh-TW"].subcommands.remove.name,
        })
        .setDescriptionLocalizations({
          [Locale.ChineseTW]:
            translations["zh-TW"].subcommands.remove.description,
        })
        .addIntegerOption((option) =>
          option
            .setName(translations["en-US"].subcommands.remove.options.id.name)
            .setDescription(
              translations["en-US"].subcommands.remove.options.id.description
            )
            .setNameLocalizations({
              [Locale.ChineseTW]:
                translations["zh-TW"].subcommands.remove.options.id.name,
            })
            .setDescriptionLocalizations({
              [Locale.ChineseTW]:
                translations["zh-TW"].subcommands.remove.options.id.description,
            })
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName(translations["en-US"].subcommands.list.name)
        .setDescription(translations["en-US"].subcommands.list.description)
        .setNameLocalizations({
          [Locale.ChineseTW]: translations["zh-TW"].subcommands.list.name,
        })
        .setDescriptionLocalizations({
          [Locale.ChineseTW]:
            translations["zh-TW"].subcommands.list.description,
        })
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName(translations["en-US"].subcommands.clear.name)
        .setDescription(translations["en-US"].subcommands.clear.description)
        .setNameLocalizations({
          [Locale.ChineseTW]: translations["zh-TW"].subcommands.clear.name,
        })
        .setDescriptionLocalizations({
          [Locale.ChineseTW]:
            translations["zh-TW"].subcommands.clear.description,
        })
    ),

  async autocomplete(interaction: AutocompleteInteraction) {
    const t = translations[interaction.locale] || translations["en-US"];
    const focusedValue = interaction.options.getFocused();
    const todos = await getTodos(mimiDLCDb, interaction.user.id);
    const choices = todos
      .filter((todo) =>
        todo.item.toLowerCase().includes(focusedValue.toLowerCase())
      )
      .map((todo) => ({
        name: t.autocomplete.id_choice
          .replace("{{id}}", todo.id.toString())
          .replace("{{item}}", todo.item),
        value: todo.id,
      }));
    await interaction.respond(choices.slice(0, 25));
  },

  async execute(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;

    const t = translations[interaction.locale] || translations["en-US"];
    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

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
      logger.error("Todo command error:", error);
      await interaction.editReply(t.general_error);
    }
  },
};
