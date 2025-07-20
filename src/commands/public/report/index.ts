import {
  SlashCommandBuilder,
  CommandInteraction,
  AutocompleteInteraction,
  AttachmentBuilder,
  TextDisplayBuilder,
  MediaGalleryBuilder,
  SeparatorBuilder,
  ContainerBuilder,
} from "discord.js";
import { MessageFlags } from "discord-api-types/v10";
import { gachaPool } from "../../../shared/database";
import {
  getAllAssetsWithLatestPrice,
  searchAssets,
  getPriceHistoryWithVolume,
} from "../../../shared/database/queries";
import { generatePriceChart } from "../../../utils/chart-generator";
import fs from "fs";
import path from "path";

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
        .addStringOption(
          (option) =>
            option
              .setName("range")
              .setDescription("e.g., 7d, 2w, 1m, 6h. Defaults to 7d")
              .setRequired(false)
          //.setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("list")
        .setDescription("List all assets with their latest price")
    ),

  async autocomplete(interaction: AutocompleteInteraction) {
    try {
      const focusedOption = interaction.options.getFocused(true);

      if (focusedOption.name === "symbol") {
        const assetListPath = path.join(__dirname, '..', '..', '..', 'config', 'asset-list.json');
        const assetList = JSON.parse(fs.readFileSync(assetListPath, 'utf8')) as { asset_symbol: string, asset_name: string }[];
        
        const focusedValue = focusedOption.value.toLowerCase();
        const choices = assetList.filter(asset => 
          asset.asset_symbol.toLowerCase().includes(focusedValue) || 
          asset.asset_name.toLowerCase().includes(focusedValue)
        ).slice(0, 25);

        await interaction.respond(
          choices.map((choice) => ({
            name: `${choice.asset_name} (${choice.asset_symbol})`,
            value: choice.asset_symbol,
          }))
        );
      } else if (focusedOption.name === "range") {
        const choices = [
          { name: "1 Day", value: "1d" },
          { name: "7 Days", value: "7d" },
          { name: "1 Month", value: "1m" },
          { name: "All Time", value: "all" },
        ];
        await interaction.respond(choices);
      }
    } catch (error) {
      console.error("Autocomplete error:", error);
    }
  },

  async execute(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;

    try {
      await interaction.deferReply(); //{ flags: MessageFlags.Ephemeral }

      const subcommand = interaction.options.getSubcommand();

      if (subcommand === "list") {
        const assets = await getAllAssetsWithLatestPrice(gachaPool);
        if (assets.length === 0) {
          await interaction.editReply("No assets found.");
          return;
        }

        let reply = `**可查詢股票列表**\n-# 目前共有 ${assets.length} 支股票\n`;
        reply += assets
          .map(
            (asset) =>
              `> \`${asset.asset_symbol}\` - ${
                asset.asset_name
              }（last update：<t:${Math.floor(
                asset.timestamp.getTime() / 1000
              )}:R>）`
          )
          .join("\n");
        reply +=
          "\n\n-# 若更新時間大於`5`分鐘可能是米米機器人出現了問題 請隨時關注最新公告";

        await interaction.editReply(reply);
      } else if (subcommand === "symbol") {
        const symbol = interaction.options.getString("symbol", true);
        const range = interaction.options.getString("range") ?? "7d";

        const since = parseTimeRange(range);
        if (!since) {
          await interaction.editReply(
            "Invalid time range. Please use a format like 7d, 2w, 1m, or a preset value."
          );
          return;
        }

        const history = await getPriceHistoryWithVolume(
          gachaPool,
          symbol,
          range
        );
        const assets = await searchAssets(gachaPool, symbol);
        const assetName =
          assets.find((a) => a.symbol === symbol)?.name || symbol;

        if (history.length === 0) {
          await interaction.editReply(
            `No data found for symbol "${symbol}" in the selected time range.`
          );
          return;
        }

        const prices = history.map((p) => p.price);
        const summary = {
          high: Math.max(...prices),
          low: Math.min(...prices),
          avg: prices.reduce((a, b) => a + b, 0) / prices.length,
          startPrice: history[0].price,
          endPrice: history[history.length - 1].price,
        };

        const chartBuffer = await generatePriceChart(history, true);
        const attachment = new AttachmentBuilder(chartBuffer, {
          name: "price-chart.png",
        });

        const change = summary.endPrice - summary.startPrice;
        const changePercent = (change / summary.startPrice) * 100;

        const container = new ContainerBuilder();

        const changeSign = change >= 0 ? "+" : "";
        const color = change >= 0 ? 0x22c55e : 0xef4444;
        container.setAccentColor(color);

        const title = new TextDisplayBuilder().setContent(
          `# ${assetName} (${symbol})`
        );
        const rangeText = new TextDisplayBuilder().setContent(
          `> Time Range: ${range}`
        );
        const summaryText = new TextDisplayBuilder().setContent(
          `• **High:** \`${summary.high.toFixed(
            2
          )}\`\n• **Low:** \`${summary.low.toFixed(
            2
          )}\`\n• **Average:** \`${summary.avg.toFixed(2)}\``
        );
        const changeText = new TextDisplayBuilder().setContent(
          `• **Price:** \`${summary.endPrice.toFixed(
            2
          )}\`\n• **Change:** \`${changeSign}${change.toFixed(
            2
          )}\` (${changeSign}${changePercent.toFixed(2)}%)`
        );
        const chartImage = new MediaGalleryBuilder().addItems((item) =>
          item
            .setURL("attachment://price-chart.png")
            .setDescription(`Price chart for ${assetName}`)
        );

        container.components.push(
          title,
          rangeText,
          new SeparatorBuilder(),
          summaryText,
          changeText,
          new SeparatorBuilder(),
          chartImage
        );

        await interaction.editReply({
          components: [container],
          files: [attachment],
          flags: MessageFlags.IsComponentsV2,
        });
      }
    } catch (error) {
      console.error("Execute error:", error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "An error occurred while fetching the report.",
          flags: MessageFlags.Ephemeral,
        });
      } else {
        await interaction.followUp({
          content: "An error occurred while fetching the report.",
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  },
};

function parseTimeRange(range: string): Date | null {
  if (range === "all") {
    return new Date(0);
  }

  const match = range.match(/^(\d+)([hdwmy])$/);
  if (!match) {
    return null;
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];
  const date = new Date();

  switch (unit) {
    case "h":
      date.setHours(date.getHours() - value);
      break;
    case "d":
      date.setDate(date.getDate() - value);
      break;
    case "w":
      date.setDate(date.getDate() - value * 7);
      break;
    case "m":
      date.setMonth(date.getMonth() - value);
      break;
    case "y":
      date.setFullYear(date.getFullYear() - value);
      break;
    default:
      return null;
  }

  return date;
}
