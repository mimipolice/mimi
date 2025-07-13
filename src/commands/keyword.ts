import {
  SlashCommandBuilder,
  CommandInteraction,
  AutocompleteInteraction,
} from "discord.js";
import {
  addKeyword,
  removeKeyword,
  getKeywords,
} from "../shared/database/queries";
import { loadCaches } from "../shared/cache";

export default {
  data: new SlashCommandBuilder()
    .setName("keyword")
    .setDescription("Manages keyword replies.")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("add")
        .setDescription("Adds or updates a keyword.")
        .addStringOption((option) =>
          option
            .setName("type")
            .setDescription("The match type.")
            .setRequired(true)
            .addChoices(
              { name: "Exact Match", value: "exact" },
              { name: "Contains Match", value: "contains" }
            )
        )
        .addStringOption((option) =>
          option
            .setName("keyword")
            .setDescription("The keyword to listen for.")
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName("reply")
            .setDescription("The reply message.")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("remove")
        .setDescription("Removes a keyword.")
        .addStringOption((option) =>
          option
            .setName("keyword")
            .setDescription("The keyword to remove.")
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("list")
        .setDescription("Lists all configured keywords.")
    ),

  async autocomplete(interaction: AutocompleteInteraction) {
    if (!interaction.guildId) return;
    const focusedValue = interaction.options.getFocused();
    const keywords = await getKeywords(interaction.guildId);
    const choices = keywords
      .filter((kw) => kw.keyword.startsWith(focusedValue))
      .map((kw) => ({ name: kw.keyword, value: kw.keyword }));
    await interaction.respond(choices.slice(0, 25));
  },

  async execute(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand() || !interaction.guildId) return;

    const subcommand = interaction.options.getSubcommand();

    try {
      await interaction.deferReply({ ephemeral: true });

      if (subcommand === "add") {
        const type = interaction.options.getString("type", true) as
          | "exact"
          | "contains";
        const keyword = interaction.options.getString("keyword", true);
        const reply = interaction.options.getString("reply", true);

        await addKeyword(interaction.guildId, keyword, reply, type);
        await loadCaches();
        await interaction.editReply(
          `Keyword "${keyword}" has been added/updated.`
        );
      } else if (subcommand === "remove") {
        const keyword = interaction.options.getString("keyword", true);
        await removeKeyword(interaction.guildId, keyword);
        await loadCaches();
        await interaction.editReply(`Keyword "${keyword}" has been removed.`);
      } else if (subcommand === "list") {
        const keywords = await getKeywords(interaction.guildId);
        if (keywords.length === 0) {
          await interaction.editReply("No keywords are set up.");
          return;
        }
        const list = keywords
          .map(
            (kw) => `**${kw.keyword}** (Type: ${kw.match_type}):\n> ${kw.reply}`
          )
          .join("\n\n");
        await interaction.editReply(`**Configured Keywords:**\n\n${list}`);
      }
    } catch (error) {
      console.error("Keyword command error:", error);
      await interaction.editReply("An error occurred while managing keywords.");
    }
  },
};
