// src/commands/public/report/index.ts

import {
  SlashCommandBuilder,
  CommandInteraction,
  Client,
  AutocompleteInteraction,
  Locale,
  AttachmentBuilder,
  MessageFlags,
} from "discord.js";
import { getOhlcPriceHistory } from "../../../repositories/asset.repository";
import assetList from "../../../config/asset-list.json";
import { generateCandlestickChart } from "../../../utils/chart-generator";
import { getLocalizations } from "../../../utils/localization";
import { errorHandler } from "../../../utils/errorHandler";
import {
  ContainerBuilder,
  MediaGalleryBuilder,
  SeparatorBuilder,
  TextDisplayBuilder,
  MediaGalleryItemBuilder,
} from "@discordjs/builders";
import { Services, Databases } from "../../../interfaces/Command";

interface Asset {
  asset_symbol: string;
  asset_name: string;
}

// NEW: K線週期設定，方便開發時調整
const CHART_INTERVAL_CONFIG = {
  // 圖表上最理想的 K 棒數量，可根據喜好調整
  TARGET_CANDLESTICK_COUNT: 30,
  // 預先定義好的、人類可讀的 K 棒週期選項
  PRESET_INTERVALS: [
    { label: "1m", seconds: 60 },
    { label: "3m", seconds: 180 },
    { label: "5m", seconds: 300 },
    { label: "15m", seconds: 900 },
    { label: "30m", seconds: 1800 },
    { label: "1h", seconds: 3600 },
    { label: "2h", seconds: 7200 },
    { label: "4h", seconds: 14400 },
    { label: "12h", seconds: 43200 },
    { label: "1d", seconds: 86400 },
    { label: "3d", seconds: 259200 },
  ],
};

// CHANGED: 全新、更智慧的 K 線週期判斷函數
function determineInterval(range: string): { seconds: number; label: string } {
  const match = range.match(/^(\d+)([hdwmy])$/);
  const fallbackInterval = { seconds: 3600, label: "1h" }; // 預設值

  if (!match) return fallbackInterval;

  const value = parseInt(match[1], 10);
  const unit = match[2];

  let totalSeconds = 0;
  switch (unit) {
    case "h":
      totalSeconds = value * 3600;
      break;
    case "d":
      totalSeconds = value * 86400;
      break;
    case "w":
      totalSeconds = value * 604800;
      break;
    case "m":
      totalSeconds = value * 2592000;
      break; // 30天
    case "y":
      totalSeconds = value * 31536000;
      break; // 365天
  }

  if (totalSeconds === 0) return fallbackInterval;

  // 計算出理想的 K 棒週期（秒）
  const idealIntervalSeconds =
    totalSeconds / CHART_INTERVAL_CONFIG.TARGET_CANDLESTICK_COUNT;

  // 從預設選項中，找出與「理想週期」最接近的一個
  let bestFit = CHART_INTERVAL_CONFIG.PRESET_INTERVALS[0];
  let smallestDiff = Math.abs(idealIntervalSeconds - bestFit.seconds);

  for (const preset of CHART_INTERVAL_CONFIG.PRESET_INTERVALS) {
    const diff = Math.abs(idealIntervalSeconds - preset.seconds);
    if (diff < smallestDiff) {
      smallestDiff = diff;
      bestFit = preset;
    }
  }
  return bestFit;
}

export default {
  data: new SlashCommandBuilder()
    .setName("report")
    // ... data 部分不變 (除了移除 interval 選項) ...
    .addSubcommand((subcommand) =>
      subcommand
        .setName("symbol")
        .setDescription("Generate a report for a specific symbol.")
        .setNameLocalizations({ [Locale.ChineseTW]: "代號" })
        .setDescriptionLocalizations({
          [Locale.ChineseTW]: "產生特定代號的報告。",
        })
        .addStringOption((option) =>
          option
            .setName("symbol")
            .setDescription("The asset symbol.")
            .setNameLocalizations({ [Locale.ChineseTW]: "代號" })
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName("range")
            .setDescription(
              "The time range for the report (e.g., 24h, 7d, 1m)."
            )
            .setNameLocalizations({ [Locale.ChineseTW]: "範圍" })
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("list")
        .setDescription("List all available asset symbols.")
        .setNameLocalizations({ [Locale.ChineseTW]: "列表" })
        .setDescriptionLocalizations({
          [Locale.ChineseTW]: "列出所有可用的資產代號。",
        })
    ),

  async autocomplete(interaction: AutocompleteInteraction) {
    const focusedValue = interaction.options.getFocused().toLowerCase();
    const filteredAssets = assetList
      .filter(
        (asset: Asset) =>
          asset.asset_name.toLowerCase().includes(focusedValue) ||
          asset.asset_symbol.toLowerCase().includes(focusedValue)
      )
      .slice(0, 25);

    await interaction.respond(
      filteredAssets.map((asset: Asset) => ({
        name: `${asset.asset_name} (${asset.asset_symbol})`,
        value: asset.asset_symbol,
      }))
    );
  },

  async execute(
    interaction: CommandInteraction,
    _client: Client,
    services: Services,
    _databases: Databases
  ) {
    // ... execute 邏輯與之前相同，只是 interval 的獲取方式改變了
    if (!interaction.isChatInputCommand()) return;

    const translations = getLocalizations(
      services.localizationManager,
      "report"
    );
    const t = translations[interaction.locale] || translations["en-US"];

    try {
      await interaction.deferReply();
      const subcommand = interaction.options.getSubcommand();

      if (subcommand === "list") {
        const assetListText = assetList
          .map((a: Asset) => `**${a.asset_name}** (${a.asset_symbol})`)
          .join("\n");
        await interaction.editReply({
          content: t.responses.asset_list + "\n" + assetListText,
        });
      } else if (subcommand === "symbol") {
        const symbol = interaction.options.getString("symbol", true);
        const range = interaction.options.getString("range") ?? "7d";

        // CHANGED: 呼叫新的智慧判斷函數
        const { seconds: intervalSeconds, label: intervalLabel } =
          determineInterval(range);

        // ... 後續邏輯完全相同 ...
        const history = await getOhlcPriceHistory(
          symbol,
          range,
          intervalSeconds
        );
        const assetName =
          assetList.find((a: Asset) => a.asset_symbol === symbol)?.asset_name ||
          symbol;

        if (history.length < 2) {
          await interaction.editReply(
            t.responses.no_data.replace("{{symbol}}", symbol)
          );
          return;
        }

        const latestOhlc = history[history.length - 1];
        const prevOhlc = history[history.length - 2];
        const change = latestOhlc.close - prevOhlc.close;
        const changePercent =
          prevOhlc.close === 0 ? 0 : (change / prevOhlc.close) * 100;

        const chartBuffer = await generateCandlestickChart(
          history,
          symbol,
          intervalLabel,
          { latestOhlc, change, changePercent },
          true
        );
        const attachment = new AttachmentBuilder(chartBuffer, {
          name: "price-chart.png",
        });

        const overallHigh = Math.max(...history.map((c) => c.high));
        const overallLow = Math.min(...history.map((c) => c.low));
        const avgPrice =
          history.reduce((acc, c) => acc + (c.high + c.low) / 2, 0) /
          history.length;
        const overallChange = latestOhlc.close - history[0].open;
        const color = overallChange >= 0 ? 0x22c55e : 0xef4444;

        const container = new ContainerBuilder();
        container.setAccentColor(color);

        const title = new TextDisplayBuilder().setContent(
          `# ${assetName} (${symbol})`
        );
        const rangeText = new TextDisplayBuilder().setContent(
          `> ${t.responses.report_range.replace("{{range}}", range)}`
        );
        const summaryText = new TextDisplayBuilder().setContent(
          `${t.responses.summary_high.replace(
            "{{price}}",
            overallHigh.toFixed(2)
          )}\n` +
            `${t.responses.summary_low.replace(
              "{{price}}",
              overallLow.toFixed(2)
            )}\n` +
            `${t.responses.summary_avg.replace(
              "{{price}}",
              avgPrice.toFixed(2)
            )}\n` +
            `${t.responses.summary_now.replace(
              "{{price}}",
              latestOhlc.close.toFixed(2)
            )}`
        );
        const chartImage = new MediaGalleryBuilder().addItems(
          (item: MediaGalleryItemBuilder) =>
            item
              .setURL("attachment://price-chart.png")
              .setDescription(
                t.responses.chart_description.replace(
                  "{{assetName}}",
                  assetName
                )
              )
        );

        container.components.push(
          title,
          rangeText,
          new SeparatorBuilder(),
          summaryText,
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
      errorHandler.handleInteractionError(interaction, error, _client);
    }
  },
};
