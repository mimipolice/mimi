import {
  SlashCommandBuilder,
  CommandInteraction,
  AutocompleteInteraction,
} from "discord.js";
import { ticketPool } from "../../../shared/database";
import {
  addTodo,
  removeTodo,
  getTodos,
  clearTodos,
} from "../../../shared/database/queries";
import { MessageFlags } from "discord-api-types/v10";

export default {
  data: new SlashCommandBuilder()
    .setName("todo")
    .setDescription("Manages your to-do list.")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("add")
        .setDescription("Adds an item to your to-do list.")
        .addStringOption((option) =>
          option
            .setName("item")
            .setDescription("The to-do item.")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("remove")
        .setDescription("Removes an item from your to-do list.")
        .addIntegerOption((option) =>
          option
            .setName("id")
            .setDescription("The ID of the item to remove.")
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("list").setDescription("Lists your to-do items.")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("clear")
        .setDescription("Clears your entire to-do list.")
    ),

  async autocomplete(interaction: AutocompleteInteraction) {
    const focusedValue = interaction.options.getFocused();
    const todos = await getTodos(ticketPool, interaction.user.id);
    const choices = todos
      .filter((todo) =>
        todo.item.toLowerCase().includes(focusedValue.toLowerCase())
      )
      .map((todo) => ({
        name: `[${todo.id}] ${todo.item}`,
        value: todo.id,
      }));
    await interaction.respond(choices.slice(0, 25));
  },

  async execute(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;

    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === "add") {
        const item = interaction.options.getString("item", true);
        await addTodo(ticketPool, userId, item);
        await interaction.editReply(`Added "${item}" to your to-do list.`);
      } else if (subcommand === "remove") {
        const id = interaction.options.getInteger("id", true);
        const removedCount = await removeTodo(ticketPool, id, userId);
        if (removedCount > 0) {
          await interaction.editReply(`Removed to-do item #${id}.`);
        } else {
          await interaction.editReply(
            `Could not find a to-do item with ID #${id} that belongs to you.`
          );
        }
      } else if (subcommand === "list") {
        const todos = await getTodos(ticketPool, userId);
        if (todos.length === 0) {
          await interaction.editReply("Your to-do list is empty.");
          return;
        }
        const list = todos
          .map((todo) => `**${todo.id}**: ${todo.item}`)
          .join("\n");
        await interaction.editReply(`**Your To-Do List:**\n${list}`);
      } else if (subcommand === "clear") {
        await clearTodos(ticketPool, userId);
        await interaction.editReply("Your to-do list has been cleared.");
      }
    } catch (error) {
      console.error("Todo command error:", error);
      await interaction.editReply(
        "An error occurred while managing your to-do list."
      );
    }
  },
};
