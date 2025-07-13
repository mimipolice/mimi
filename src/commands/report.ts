import {
  SlashCommandBuilder,
  CommandInteraction,
  AutocompleteInteraction,
  AttachmentBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  MediaGalleryBuilder,
  SeparatorBuilder,
} from "discord.js";
import { MessageFlags } from "discord-api-types/v10";
import {
  getAssetPriceHistory,
  getAllAssetsWithLatestPrice,
  getAssetSummary,
  searchAssets,
} from "../shared/database/queries";
import { generatePriceChart } from "../utils/chart-generator";

export default {
  data: new SlashCommandBuilder()
    .setName("report")
    .setDescription("Generates a price report for assets.")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("symbol")
        .setDescription("Get a detailed report for a single asset")
        .addStringOption((option) =>
          option
            .setName("symbol")
            .setDescription("The symbol or name of the asset")
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName("time_range")
            .setDescription("The time range for the report (default: 7d)")
            .setRequired(false)
            .addChoices(
              { name: "1 Day", value: "1d" },
              { name: "7 Days", value: "7d" },
              { name: "1 Month", value: "1m" },
              { name: "All Time", value: "all" }
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("list")
        .setDescription("List all assets with their latest price")
    ),

  async autocomplete(interaction: AutocompleteInteraction) {
    try {
      const focusedValue = interaction.options.getFocused();
      const choices = await searchAssets(focusedValue);
      await interaction.respond(
        choices.map((choice) => ({
          name: `${choice.name} (${choice.symbol})`,
          value: choice.symbol,
        }))
      );
    } catch (error) {
      console.error("Autocomplete error:", error);
    }
  },

  async execute(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;

    try {
      await interaction.deferReply({ ephemeral: false });

      const subcommand = interaction.options.getSubcommand();

      if (subcommand === "list") {
        const assets = await getAllAssetsWithLatestPrice();
        const reply = assets
          .map(
            (asset) =>
              `**${asset.asset_name} (${
                asset.asset_symbol
              })**: ${asset.price.toFixed(
                2
              )} (as of ${asset.timestamp.toLocaleDateString()})`
          )
          .join("\n");
        await interaction.editReply(reply || "No assets found.");
      } else if (subcommand === "symbol") {
        const symbol = interaction.options.getString("symbol", true);
        const timeRange = interaction.options.getString("time_range") ?? "7d";

        const history = await getAssetPriceHistory(symbol, timeRange);
        const summary = await getAssetSummary(symbol, timeRange);
        const assets = await searchAssets(symbol);
        const assetName =
          assets.find((a) => a.symbol === symbol)?.name || symbol;

        if (history.length === 0 || !summary) {
          await interaction.editReply(
            `No data found for symbol "${symbol}" in the selected time range.`
          );
          return;
        }

        const chartBuffer = await generatePriceChart(history);
        const attachment = new AttachmentBuilder(chartBuffer, {
          name: "price-chart.png",
        });

        const change = summary.endPrice - summary.startPrice;
        const changePercent = (change / summary.startPrice) * 100;

        const components = [
          new TextDisplayBuilder().setContent(`**${assetName} (${symbol})**`),
          new TextDisplayBuilder().setContent(`Time Range: ${timeRange}`),
          new SeparatorBuilder(),
          new TextDisplayBuilder().setContent(
            `• **High:** \`${summary.high.toFixed(2)}\``
          ),
          new TextDisplayBuilder().setContent(
            `• **Low:** \`${summary.low.toFixed(2)}\``
          ),
          new TextDisplayBuilder().setContent(
            `• **Average:** \`${summary.avg.toFixed(2)}\``
          ),
          new SeparatorBuilder(),
          new TextDisplayBuilder().setContent(
            `• **Start Price:** \`${summary.startPrice.toFixed(2)}\``
          ),
          new TextDisplayBuilder().setContent(
            `• **End Price:** \`${summary.endPrice.toFixed(2)}\``
          ),
          new TextDisplayBuilder().setContent(
            `• **Change:** \`${change.toFixed(2)}\` (${changePercent.toFixed(
              2
            )}%)`
          ),
          new SeparatorBuilder(),
          new MediaGalleryBuilder().addItems((item) =>
            item
              .setURL("attachment://price-chart.png")
              .setDescription(`Price chart for ${assetName}`)
          ),
        ];

        await interaction.editReply({
          content: "",
          components,
          files: [attachment],
          flags: MessageFlags.IsComponentsV2,
        });
      }
    } catch (error) {
      console.error("Execute error:", error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "An error occurred while fetching the report.",
          ephemeral: true,
        });
      } else {
        await interaction.followUp({
          content: "An error occurred while fetching the report.",
          ephemeral: true,
        });
      }
    }
  },
};
