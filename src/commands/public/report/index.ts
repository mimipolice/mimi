import {
  SlashCommandBuilder,
  CommandInteraction,
  AutocompleteInteraction,
  AttachmentBuilder,
  TextDisplayBuilder,
  MediaGalleryBuilder,
  SeparatorBuilder,
  ContainerBuilder,
  Locale,
  Client,
} from "discord.js";
import { MessageFlags } from "discord-api-types/v10";
import {
  getAllAssetsWithLatestPrice,
  searchAssets,
  getPriceHistoryWithVolume,
} from "../../../shared/database/queries";
import { generatePriceChart } from "../../../utils/chart-generator";
import fs from "fs";
import path from "path";
import { getLocalizations } from "../../../utils/localization";
import logger from "../../../utils/logger";

import { Command, Databases, Services } from "../../../interfaces/Command";

export default {
  data: new SlashCommandBuilder()
    .setName("report")
    .setDescription("Generate a price report for an asset.")
    .setNameLocalizations({
      [Locale.EnglishUS]: "report",
      [Locale.ChineseTW]: "報告",
    })
    .setDescriptionLocalizations({
      [Locale.EnglishUS]: "Generate a price report for an asset.",
      [Locale.ChineseTW]: "產生資產的價格報告。",
    })
    .addSubcommand((subcommand) =>
      subcommand
        .setName("symbol")
        .setDescription("Generate a report for a specific symbol.")
        .setNameLocalizations({
          [Locale.EnglishUS]: "symbol",
          [Locale.ChineseTW]: "代號",
        })
        .setDescriptionLocalizations({
          [Locale.EnglishUS]: "Generate a report for a specific symbol.",
          [Locale.ChineseTW]: "產生特定代號的報告。",
        })
        .addStringOption((option) =>
          option
            .setName("symbol")
            .setDescription("The asset symbol.")
            .setNameLocalizations({
              [Locale.EnglishUS]: "symbol",
              [Locale.ChineseTW]: "代號",
            })
            .setDescriptionLocalizations({
              [Locale.EnglishUS]: "The asset symbol.",
              [Locale.ChineseTW]: "資產代號。",
            })
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName("range")
            .setDescription("The time range for the report.")
            .setNameLocalizations({
              [Locale.EnglishUS]: "range",
              [Locale.ChineseTW]: "範圍",
            })
            .setDescriptionLocalizations({
              [Locale.EnglishUS]: "The time range for the report.",
              [Locale.ChineseTW]: "報告的時間範圍。",
            })
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("list")
        .setDescription("List all available assets.")
        .setNameLocalizations({
          [Locale.EnglishUS]: "list",
          [Locale.ChineseTW]: "列表",
        })
        .setDescriptionLocalizations({
          [Locale.EnglishUS]: "List all available assets.",
          [Locale.ChineseTW]: "列出所有股票。",
        })
    ),

  async autocomplete(interaction: AutocompleteInteraction) {
    try {
      const focusedOption = interaction.options.getFocused(true);

      if (focusedOption.name === "symbol") {
        const assetListPath = path.join(
          __dirname,
          "..",
          "..",
          "..",
          "config",
          "asset-list.json"
        );
        const assetList = JSON.parse(
          fs.readFileSync(assetListPath, "utf8")
        ) as {
          asset_symbol: string;
          asset_name: string;
        }[];

        const focusedValue = focusedOption.value.toLowerCase();
        const choices = assetList
          .filter(
            (asset) =>
              asset.asset_symbol.toLowerCase().includes(focusedValue) ||
              asset.asset_name.toLowerCase().includes(focusedValue)
          )
          .slice(0, 25);

        await interaction.respond(
          choices.map((choice) => ({
            name: `${choice.asset_name} (${choice.asset_symbol})`,
            value: choice.asset_symbol,
          }))
        );
      }
    } catch (error) {
      logger.error("Autocomplete error:", error);
    }
  },

  async execute(
    interaction: CommandInteraction,
    _client: Client,
    { localizationManager }: Services,
    _databases: Databases
  ) {
    if (!interaction.isChatInputCommand()) return;

    const translations = getLocalizations(localizationManager, "report");
    const t = translations[interaction.locale] || translations["en-US"];

    try {
      await interaction.deferReply();

      const subcommand = interaction.options.getSubcommand();

      if (subcommand === "list") {
        const assets = await getAllAssetsWithLatestPrice();
        if (assets.length === 0) {
          await interaction.editReply(
            t.responses.no_data.replace("{{symbol}}", "any")
          );
          return;
        }

        let reply = `${
          t.responses.list_title
        }\n-# ${t.responses.list_total.replace(
          "{{count}}",
          assets.length.toString()
        )}\n`;
        reply += assets
          .map((asset) =>
            t.responses.list_asset_line
              .replace("{{symbol}}", asset.asset_symbol)
              .replace("{{name}}", asset.asset_name)
              .replace(
                "{{timestamp}}",
                Math.floor(asset.timestamp.getTime() / 1000).toString()
              )
          )
          .join("\n");
        reply += `\n\n-# ${t.responses.list_footer}`;

        await interaction.editReply(reply);
      } else if (subcommand === "symbol") {
        const symbol = interaction.options.getString("symbol", true);
        const range = interaction.options.getString("range") ?? "7d";

        const since = parseTimeRange(range);
        if (!since) {
          await interaction.editReply(t.responses.invalid_range);
          return;
        }

        const history = await getPriceHistoryWithVolume(symbol, range);
        const assets = await searchAssets(symbol);
        const assetName =
          assets.find((a) => a.symbol === symbol)?.name || symbol;

        if (history.length === 0) {
          await interaction.editReply(
            t.responses.no_data.replace("{{symbol}}", symbol)
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
          t.responses.report_range.replace("{{range}}", range)
        );
        const summaryText = new TextDisplayBuilder().setContent(
          `${t.responses.summary_high.replace(
            "{{price}}",
            summary.high.toFixed(2)
          )}\n${t.responses.summary_low.replace(
            "{{price}}",
            summary.low.toFixed(2)
          )}\n${t.responses.summary_avg.replace(
            "{{price}}",
            summary.avg.toFixed(2)
          )}`
        );
        const changeText = new TextDisplayBuilder().setContent(
          `${t.responses.summary_price.replace(
            "{{price}}",
            summary.endPrice.toFixed(2)
          )}\n${t.responses.summary_change
            .replace(/{{sign}}/g, changeSign)
            .replace("{{change}}", change.toFixed(2))
            .replace("{{percent}}", changePercent.toFixed(2))}`
        );
        const chartImage = new MediaGalleryBuilder().addItems((item) =>
          item
            .setURL("attachment://price-chart.png")
            .setDescription(
              t.responses.chart_description.replace("{{assetName}}", assetName)
            )
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
      logger.error("Execute error:", error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: t.responses.error_fetching,
          flags: MessageFlags.Ephemeral,
        });
      } else {
        await interaction.followUp({
          content: t.responses.error_fetching,
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
