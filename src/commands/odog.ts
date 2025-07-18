import {
  SlashCommandBuilder,
  CommandInteraction,
  AutocompleteInteraction,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
} from "discord.js";
import { MessageFlags } from "discord-api-types/v10";
import {
  getOdogRankings,
  getGachaPools,
  getGachaPoolById,
} from "../shared/database/queries";
import { gachaPool } from "../shared/database";

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
      const choices = await getGachaPools(gachaPool, focusedValue);
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

      const rankings = await getOdogRankings(
        gachaPool,
        gachaId,
        days as number | "all"
      );

      if (rankings.length === 0) {
        await interaction.editReply(
          "No ranking data found for the specified gacha pool and period."
        );
        return;
      }

      const container = new ContainerBuilder();
      container.setAccentColor(0xffd700); // Gold color for rankings
      container.setSpoiler(true);

      const gachaPoolInfo = gachaId
        ? await getGachaPoolById(gachaPool, gachaId)
        : null;
      const gachaName = gachaPoolInfo
        ? `${gachaPoolInfo.gacha_name} (${gachaPoolInfo.gacha_name_alias})`
        : "Global";

      const titleText = `Odog Rankings for ${gachaName} (Last ${period})`;

      const title = new TextDisplayBuilder().setContent(`# ${titleText}`);
      container.components.push(title, new SeparatorBuilder());

      rankings.slice(0, 15).forEach((user, index) => {
        const rarityDetails = user.rarity_counts
          ? Object.entries(user.rarity_counts)
              .sort(([a], [b]) => Number(b) - Number(a))
              .map(([rarity, count]) => `R${rarity}: ${count}`)
              .join(" | ")
          : "No top-tier draws";

        const userRankText = new TextDisplayBuilder().setContent(
          `**${index + 1}.** ${
            user.nickname || `User ${user.user_id}`
          } - ${rarityDetails} (Total: ${user.total_draws})`
        );
        container.components.push(userRankText);
      });

      await interaction.editReply({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
      });
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
