// src/commands/public/report/index.ts

import {
  SlashCommandBuilder,
  CommandInteraction,
  Client,
  AutocompleteInteraction,
  Locale,
  AttachmentBuilder,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
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
import moment from "moment";
import { buildSummaryText } from "./summaryBuilder";
import { ChartCacheService } from "../../../services/ChartCacheService";
import { createStockSelectMenu } from "../../../interactions/selectMenus/stockSelect";

interface Asset {
  asset_symbol: string;
  asset_name: string;
}

function formatPrice(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
}

// NEW: K線週期設定，方便開發時調整
const CHART_INTERVAL_CONFIG = {
  // 圖表上最理想的 K 棒數量，可根據喜好調整
  TARGET_CANDLESTICK_COUNT: 35,
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

// Helper function to get report data, with caching
export async function getReportData(
  symbol: string,
  range: string,
  services: Services
) {
  const cacheKey = `report-data:${symbol}:${range}`;
  const cachedData = await services.cacheService.get<any>(cacheKey);
  if (cachedData) {
    // Manually convert date strings back to Date objects
    cachedData.history.forEach((point: any) => {
      point.timestamp = new Date(point.timestamp);
    });
    // Add this check to ensure old cache formats don't break things
    if (!cachedData.generatedAt) {
      cachedData.generatedAt = Date.now();
    }
    return cachedData;
  }

  const { seconds: intervalSeconds, label: intervalLabel } =
    determineInterval(range);
  const { ohlcData: history, rawDataPointCount } = await getOhlcPriceHistory(
    symbol,
    range,
    intervalSeconds
  );

  if (history.length < 2) {
    return null;
  }

  const latestOhlc = history[history.length - 1];
  const prevOhlc = history[history.length - 2];
  const change = latestOhlc.close - prevOhlc.close;
  const changePercent =
    prevOhlc.close === 0 ? 0 : (change / prevOhlc.close) * 100;

  const firstOhlc = history[0];
  const startPrice = firstOhlc.open;
  const endPrice = latestOhlc.close;
  const totalChangeValue = endPrice - startPrice;
  const totalChangePercent =
    startPrice === 0 ? 0 : (totalChangeValue / startPrice) * 100;

  const highRecord = history.reduce((max, p) => (p.high > max.high ? p : max));
  const lowRecord = history.reduce((min, p) => (p.low < min.low ? p : min));
  const overallHigh = highRecord.high;
  const overallLow = lowRecord.low;
  const highTimestamp = Math.floor(highRecord.timestamp.getTime() / 1000);
  const lowTimestamp = Math.floor(lowRecord.timestamp.getTime() / 1000);

  const avgPrice =
    history.reduce((acc, c) => acc + (c.high + c.low) / 2, 0) / history.length;
  const volatilityValue = overallHigh - overallLow;
  const volatilityPercent =
    avgPrice === 0 ? 0 : (volatilityValue / avgPrice) * 100;

  const startTime = moment(firstOhlc.timestamp);
  const endTime = moment(latestOhlc.timestamp);
  const duration = moment.duration(endTime.diff(startTime));
  const durationHuman = duration.humanize();

  const totalVolume = history.reduce((acc, c) => acc + c.volume, 0);
  const avgVolume = totalVolume / history.length;
  const highVolumeRecord = history.reduce((max, p) =>
    p.volume > max.volume ? p : max
  );
  const lowVolumeRecord = history.reduce((min, p) =>
    p.volume < min.volume ? p : min
  );
  const highVolumeTimestamp = Math.floor(
    highVolumeRecord.timestamp.getTime() / 1000
  );
  const lowVolumeTimestamp = Math.floor(
    lowVolumeRecord.timestamp.getTime() / 1000
  );

  const reportData = {
    generatedAt: Date.now(),
    history,
    rawDataPointCount,
    intervalLabel,
    latestOhlc,
    change,
    changePercent,
    startPrice,
    endPrice,
    totalChangeValue,
    totalChangePercent,
    overallHigh,
    overallLow,
    highTimestamp,
    lowTimestamp,
    avgPrice,
    volatilityValue,
    volatilityPercent,
    startTime: startTime.toISOString(), // Store as ISO string for JSON compatibility
    endTime: endTime.toISOString(),
    durationHuman,
    totalVolume,
    avgVolume,
    highVolumeRecord,
    lowVolumeRecord,
    highVolumeTimestamp,
    lowVolumeTimestamp,
  };

  await services.cacheService.set(cacheKey, reportData, 900); // 15 minute TTL
  return reportData;
}

export default {
  data: new SlashCommandBuilder()
    .setName("report")
    .setDescription("Generates a report or lists available assets.")
    .setDescriptionLocalizations({
      [Locale.ChineseTW]: "產生報告或列出可用的資產。",
    })
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
      // Only defer if not already deferred or replied
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply();
      }
      const subcommand = interaction.options.getSubcommand();

      if (subcommand === "list") {
        // 從快取或資料庫取得價格變化資料
        const cacheKey = "asset-price-changes";
        let priceChanges = await services.cacheService.get<any[]>(cacheKey);

        if (!priceChanges) {
          const assetPriceCacheRepo = await import(
            "../../../repositories/asset-price-cache.repository.js"
          );
          priceChanges = await assetPriceCacheRepo.getAllAssetsWithPriceChange();
          // 快取 5 分鐘（價格每 10 分鐘更新，快取 5 分鐘可以減少查詢）
          await services.cacheService.set(cacheKey, priceChanges, 300);
        }

        // 建立價格 map
        const priceMap = new Map(
          (priceChanges || []).map((p: any) => [p.asset_symbol, p])
        );

        // Build Components V2 container
        const container = new ContainerBuilder();
        container.setAccentColor(0x5865f2);

        // Title
        const title = new TextDisplayBuilder().setContent(
          `# ${t.responses.asset_list || "可選資產列表"}\n*價格每 10 分鐘更新*`
        );

        // Build asset list text with price changes
        let assetListText = "";
        for (const asset of assetList as Asset[]) {
          const priceInfo = priceMap.get(asset.asset_symbol);

          if (priceInfo) {
            const isUp = priceInfo.change_percent >= 0;
            const emoji = isUp
              ? ":chart_with_upwards_trend:"
              : ":chart_with_downwards_trend:";
            const sign = isUp ? "+" : "";

            assetListText += `**${asset.asset_name}** (${asset.asset_symbol}) ${emoji} ${sign}${priceInfo.change_percent.toFixed(2)}%\n`;
          } else {
            assetListText += `**${asset.asset_name}** (${asset.asset_symbol}) 💤\n`;
          }
        }

        const listContent = new TextDisplayBuilder().setContent(assetListText);

        // Info text
        const infoText = new TextDisplayBuilder().setContent(
          "💡 使用下方選單快速查看股票報告"
        );

        // Create stock select menu
        const stockSelectMenu = createStockSelectMenu(
          "7d",
          interaction.user.id
        );

        container.components.push(
          title,
          new SeparatorBuilder(),
          listContent,
          new SeparatorBuilder(),
          infoText,
          stockSelectMenu
        );

        await interaction.editReply({
          components: [container],
          flags: MessageFlags.IsComponentsV2,
        });
      } else if (subcommand === "symbol") {
        const symbol = interaction.options.getString("symbol", true);
        const range = interaction.options.getString("range") ?? "7d";

        const data = await getReportData(symbol, range, services);

        if (!data) {
          await interaction.editReply(
            t.responses.no_data.replace("{{symbol}}", symbol)
          );
          return;
        }

        const {
          history,
          intervalLabel,
          latestOhlc,
          change,
          changePercent,
          totalChangeValue,
          generatedAt,
        } = data;

        const assetName =
          assetList.find((a: Asset) => a.asset_symbol === symbol)?.asset_name ||
          symbol;

        const chartBuffer = await generateCandlestickChart(
          history,
          symbol,
          intervalLabel,
          { latestOhlc, change, changePercent },
          true
        );

        // NEW: Cache the chart image to the filesystem
        const chartCacheService = new ChartCacheService();
        const chartCacheKey = `report-chart:${symbol}:${range}`;
        const chartPath = await chartCacheService.saveChart(
          chartCacheKey,
          chartBuffer
        );

        if (!chartPath) {
          // Handle error if chart saving fails
          await interaction.editReply(t.responses.chart_error);
          return;
        }

        const attachment = new AttachmentBuilder(chartPath, {
          name: "price-chart.png",
        });

        const color = totalChangeValue >= 0 ? 0x22c55e : 0xef4444;

        // Create a t-function that matches the builder's expectation
        const tFunc = (
          key: string,
          replacements?: { [key: string]: string | number }
        ) => {
          let translation = t.responses[key.split(".")[1]];
          if (replacements) {
            for (const [k, v] of Object.entries(replacements)) {
              translation = translation.replace(`{{${k}}}`, String(v));
            }
          }
          return translation;
        };

        const container = new ContainerBuilder();
        container.setAccentColor(color);

        const title = new TextDisplayBuilder().setContent(
          t.responses.report_title.replace("{{assetName}}", assetName)
        );
        const lastUpdated = new TextDisplayBuilder().setContent(
          t.responses.last_updated.replace(
            "{{timestamp}}",
            Math.floor(Date.now() / 1000).toString()
          )
        );

        const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`report-price-${symbol}-${range}-${generatedAt}`)
            .setLabel(t.responses.button_price_analysis)
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId(`report-detailed-${symbol}-${range}-${generatedAt}`)
            .setLabel(t.responses.button_detailed_price)
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(`report-volume-${symbol}-${range}-${generatedAt}`)
            .setLabel(t.responses.button_volume_analysis)
            .setStyle(ButtonStyle.Secondary)
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

        const priceSummary = new TextDisplayBuilder().setContent(
          `## ${formatPrice(data.latestOhlc.close)} ${formatPercent(
            data.change
          )} (${formatPercent(data.changePercent)}%)`
        );

        // Create stock select menu
        const stockSelectMenu = createStockSelectMenu(range, interaction.user.id);

        container.components.push(
          title,
          lastUpdated,
          priceSummary,
          new SeparatorBuilder(),
          buildSummaryText("price", tFunc, data),
          new SeparatorBuilder(),
          buttons,
          new SeparatorBuilder(),
          chartImage,
          new SeparatorBuilder(),
          stockSelectMenu
        );

        await interaction.editReply({
          components: [container],
          files: [attachment],
          flags: MessageFlags.IsComponentsV2,
        });
      }
    } catch (error) {
      errorHandler.handleInteractionError(
        interaction,
        error,
        _client,
        services
      );
    }
  },
};
