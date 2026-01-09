import {
  StringSelectMenuInteraction,
  MessageFlags,
  AttachmentBuilder,
  ButtonStyle,
} from "discord.js";
import { createUnauthorizedReply } from "../../utils/interactionReply";
import { Services } from "../../interfaces/Command";
import { getReportData } from "../../commands/public/report/index";
import { generateCandlestickChart } from "../../utils/chart-generator";
import { ChartCacheService } from "../../services/ChartCacheService";
import {
  ContainerBuilder,
  MediaGalleryBuilder,
  SeparatorBuilder,
  TextDisplayBuilder,
  MediaGalleryItemBuilder,
  ActionRowBuilder,
  ButtonBuilder,
} from "@discordjs/builders";
import { buildSummaryText } from "../../commands/public/report/summaryBuilder";
import { getLocalizations } from "../../utils/localization";
import assetList from "../../config/asset-list.json";
import logger from "../../utils/logger";

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

export default {
  name: "stock-select",
  async execute(interaction: StringSelectMenuInteraction, services: Services) {
    try {
      // Parse customId: stock-select:range:originalUserId
      const [_, range, originalUserId] = interaction.customId.split(":");
      const selectedSymbol = interaction.values[0];
      const userId = interaction.user.id;

      // Check authorization
      if (originalUserId && userId !== originalUserId) {
        await interaction.reply(
          createUnauthorizedReply(services.localizationManager, interaction)
        );
        return;
      }

      // Defer the update since we need to fetch data
      await interaction.deferUpdate();

      const translations = getLocalizations(
        services.localizationManager,
        "report"
      );
      const t = translations[interaction.locale] || translations["en-US"];

      // Get report data
      const data = await getReportData(selectedSymbol, range || "7d", services);

      if (!data) {
        await interaction.editReply({
          content: t.responses.no_data.replace("{{symbol}}", selectedSymbol),
          components: [],
        });
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
        assetList.find((a: Asset) => a.asset_symbol === selectedSymbol)
          ?.asset_name || selectedSymbol;

      // Generate chart
      const chartBuffer = await generateCandlestickChart(
        history,
        selectedSymbol,
        intervalLabel,
        { latestOhlc, change, changePercent },
        true
      );

      // Cache the chart
      const chartCacheService = new ChartCacheService();
      const chartCacheKey = `report-chart:${selectedSymbol}:${range}`;
      const chartPath = await chartCacheService.saveChart(
        chartCacheKey,
        chartBuffer
      );

      if (!chartPath) {
        await interaction.editReply({
          content: t.responses.chart_error,
          components: [],
        });
        return;
      }

      const attachment = new AttachmentBuilder(chartPath, {
        name: "price-chart.png",
      });

      const color = totalChangeValue >= 0 ? 0x22c55e : 0xef4444;

      // Create translation function
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

      // Build container
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

      const priceSummary = new TextDisplayBuilder().setContent(
        `## ${formatPrice(data.latestOhlc.close)} ${formatPercent(
          data.change
        )} (${formatPercent(data.changePercent)}%)`
      );

      const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`report-price-${selectedSymbol}-${range}-${generatedAt}`)
          .setLabel(t.responses.button_price_analysis)
          .setStyle(ButtonStyle.Primary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId(
            `report-detailed-${selectedSymbol}-${range}-${generatedAt}`
          )
          .setLabel(t.responses.button_detailed_price)
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(
            `report-volume-${selectedSymbol}-${range}-${generatedAt}`
          )
          .setLabel(t.responses.button_volume_analysis)
          .setStyle(ButtonStyle.Secondary)
      );

      const chartImage = new MediaGalleryBuilder().addItems(
        (item: MediaGalleryItemBuilder) =>
          item
            .setURL("attachment://price-chart.png")
            .setDescription(
              t.responses.chart_description.replace("{{assetName}}", assetName)
            )
      );

      // Recreate the stock select menu with the same options
      const stockSelectMenu = createStockSelectMenu(range || "7d", userId);

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
    } catch (error) {
      logger.error(`Error executing stock select menu (by <@${interaction.user.id}> / ${interaction.user.id}):`, error);
      await interaction.editReply({
        content: "處理您的選擇時發生了未預期的錯誤。",
        components: [],
      });
    }
  },
};

// Helper function to create the stock select menu wrapped in ActionRow
export function createStockSelectMenu(range: string, userId: string) {
  const { StringSelectMenuBuilder } = require("@discordjs/builders");
  
  // Get top 25 assets for the select menu
  const topAssets = assetList.slice(0, 25) as Asset[];

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`stock-select:${range}:${userId}`)
    .setPlaceholder("選擇其他股票查看報告...")
    .addOptions(
      topAssets.map((asset) => ({
        label: `${asset.asset_name} (${asset.asset_symbol})`,
        value: asset.asset_symbol,
      }))
    );

  // Wrap in ActionRow for Components V2 compatibility
  const actionRow = new ActionRowBuilder().addComponents(selectMenu);
  
  return actionRow;
}
