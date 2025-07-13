import {
  SlashCommandBuilder,
  CommandInteraction,
  AutocompleteInteraction,
} from "discord.js";
import {
  getOdogRankings,
  getGachaPools,
  searchAssets,
} from "../shared/database/queries";

export default {
  data: new SlashCommandBuilder()
    .setName("odog")
    .setDescription("Shows the Odog gacha rankings.")
    .addStringOption((option) =>
      option
        .setName("gacha_id")
        .setDescription("The ID of the gacha pool to rank.")
        .setRequired(false)
        .setAutocomplete(true)
    )
    .addStringOption((option) =>
      option
        .setName("period")
        .setDescription("The time period for the rankings (e.g., 7d, all)")
        .setRequired(false)
    ),

  async autocomplete(interaction: AutocompleteInteraction) {
    try {
      const focusedValue = interaction.options.getFocused();
      const choices = await getGachaPools(focusedValue);
      await interaction.respond(
        choices.map((choice) => ({
          name: `${choice.gacha_name} (${choice.gacha_name_alias})`,
          value: choice.gacha_id,
        }))
      );
    } catch (error) {
      console.error("Autocomplete error:", error);
    }
  },

  async execute(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;

    await interaction.deferReply();

    try {
      const gachaId = interaction.options.getString("gacha_id");
      const period = interaction.options.getString("period") ?? "7d";
      const days = period === "all" ? "all" : parseInt(period.replace("d", ""));

      if (isNaN(days as number) && days !== "all") {
        await interaction.editReply({
          content:
            'Invalid period format. Use "all" or a number of days (e.g., "7d").',
        });
        return;
      }

      const rankings = await getOdogRankings(gachaId, days as number | "all");

      if (rankings.length === 0) {
        await interaction.editReply(
          "No ranking data found for the specified gacha pool and period."
        );
        return;
      }

      const title = gachaId
        ? `Odog Rankings for ${gachaId} (Last ${period})`
        : `Global Odog Rankings (Last ${period})`;

      let reply = `**${title}**\n----------------------------------\n`;
      rankings.slice(0, 15).forEach((user, index) => {
        const rarityDetails = user.rarity_counts
          ? Object.entries(user.rarity_counts)
              .sort(([a], [b]) => Number(b) - Number(a))
              .map(([rarity, count]) => `R${rarity}: ${count}`)
              .join(" | ")
          : "No top-tier draws";

        reply += `${index + 1}. ${
          user.nickname || `User ${user.user_id}`
        } | ${rarityDetails} | Total Draws: ${user.total_draws}\n`;
      });

      await interaction.editReply(reply);
    } catch (error) {
      console.error(error);
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({
          content: "An error occurred while fetching the rankings.",
        });
      }
    }
  },
};
