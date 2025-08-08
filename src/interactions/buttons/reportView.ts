import {
  ButtonInteraction,
  Client,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  AttachmentBuilder,
} from "discord.js";
import {
  ContainerBuilder,
  MediaGalleryBuilder,
  SeparatorBuilder,
  TextDisplayBuilder,
  MediaGalleryItemBuilder,
} from "@discordjs/builders";
import { Services, Databases } from "../../interfaces/Command";
import { createUnauthorizedReply } from "../../utils/interactionReply";
import { getLocalizations } from "../../utils/localization";
import { errorHandler } from "../../utils/errorHandler";
import { getReportData } from "../../commands/public/report";
import { buildSummaryText } from "../../commands/public/report/summaryBuilder";
import assetList from "../../config/asset-list.json";
import { ChartCacheService } from "../../services/ChartCacheService";

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
  name: "reportView",
  async execute(
    interaction: ButtonInteraction,
    _client: Client,
    services: Services,
    _databases: Databases
  ) {
    try {
      // [FIX] Check if the interactor is the original command user
      if (
        interaction.message.interaction?.user.id &&
        interaction.user.id !== interaction.message.interaction.user.id
      ) {
        return interaction.reply(
          createUnauthorizedReply(services.localizationManager, interaction)
        );
      }

      await interaction.deferUpdate();

      const [_, view, symbol, range, generatedAt] =
        interaction.customId.split("-");

      const translations = getLocalizations(
        services.localizationManager,
        "report"
      );
      const t = translations[interaction.locale] || translations["en-US"];

      const data = await getReportData(symbol, range, services);

      if (!data) {
        // Should not happen if the button exists, but as a safeguard
        await interaction.followUp({
          content: t.responses.error_fetching,
          ephemeral: true,
        });
        return;
      }

      const { totalChangeValue } = data;

      const assetName =
        assetList.find((a) => a.asset_symbol === symbol)?.asset_name || symbol;

      // Rebuild the entire container to ensure full localization
      const color = totalChangeValue >= 0 ? 0x22c55e : 0xef4444;
      const container = new ContainerBuilder().setAccentColor(color);

      const title = new TextDisplayBuilder().setContent(
        t.responses.report_title.replace("{{assetName}}", assetName)
      );

      // Extract original timestamp to keep it consistent
      const originalComponent = interaction.message.components[0];
      if (originalComponent?.type !== ComponentType.Container) {
        // This should not happen in a valid report message
        await interaction.followUp({
          content: "Error: Could not find the original message container.",
          ephemeral: true,
        });
        return;
      }
      const originalContainerJSON = originalComponent.toJSON();

      let lastUpdatedContent = "";
      const originalLastUpdatedComponent =
        originalContainerJSON.components.find(
          (c) =>
            c.type === ComponentType.TextDisplay &&
            "content" in c &&
            c.content.includes(t.responses.last_updated.split("<t:")[0])
        );

      if (
        originalLastUpdatedComponent &&
        originalLastUpdatedComponent.type === ComponentType.TextDisplay
      ) {
        lastUpdatedContent = originalLastUpdatedComponent.content;
      }
      const lastUpdated = new TextDisplayBuilder().setContent(
        lastUpdatedContent
      );

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

      const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`report-price-${symbol}-${range}-${generatedAt}`)
          .setLabel(t.responses.button_price_analysis)
          .setStyle(ButtonStyle.Primary)
          .setDisabled(view === "price"),
        new ButtonBuilder()
          .setCustomId(`report-detailed-${symbol}-${range}-${generatedAt}`)
          .setLabel(t.responses.button_detailed_price)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(view === "detailed"),
        new ButtonBuilder()
          .setCustomId(`report-volume-${symbol}-${range}-${generatedAt}`)
          .setLabel(t.responses.button_volume_analysis)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(view === "volume")
      );

      const priceSummary = new TextDisplayBuilder().setContent(
        `## ${formatPrice(data.latestOhlc.close)} ${formatPercent(
          data.change
        )} (${formatPercent(data.changePercent)}%)`
      );

      container.components.push(
        title,
        lastUpdated,
        priceSummary,
        new SeparatorBuilder(),
        buildSummaryText(view as "price" | "detailed" | "volume", tFunc, data),
        new SeparatorBuilder(),
        buttons
      );

      // NEW: Use the ChartCacheService to get the chart from the local filesystem
      const chartCacheService = new ChartCacheService();
      const chartCacheKey = `report-chart:${symbol}:${range}`;
      const chartPath = chartCacheService.getChartPath(chartCacheKey);

      // [FIX] Check if the chart file still exists AND if the data timestamp matches.
      if (data.generatedAt.toString() !== generatedAt) {
        // Data is stale.
        const disabledButtons =
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            ...buttons.components.map((button) => button.setDisabled(true))
          );
        container.spliceComponents(
          container.components.length - 1,
          1,
          disabledButtons
        );

        // Try to preserve the existing image from the message
        const existingAttachment = interaction.message.attachments.first();
        if (existingAttachment) {
          const chartImage = new MediaGalleryBuilder().addItems(
            (item: MediaGalleryItemBuilder) =>
              item
                .setURL(existingAttachment.url)
                .setDescription(
                  t.responses.chart_description.replace(
                    "{{assetName}}",
                    assetName
                  )
                )
          );
          container.components.push(new SeparatorBuilder(), chartImage);
        }

        // Explicitly tell Discord to keep the existing attachments.
        const attachmentsToKeep = interaction.message.attachments.map((att) => {
          return { id: att.id };
        });

        await interaction.editReply({
          components: [container],
          attachments: attachmentsToKeep,
        });

        // Send a follow-up message explaining why.
        await interaction.followUp({
          content: t.responses.report_stale,
          ephemeral: true,
        });

        return; // Stop further execution
      }

      const attachment = new AttachmentBuilder(chartPath, {
        name: "price-chart.png",
      });

      const chartImage = new MediaGalleryBuilder().addItems(
        (item: MediaGalleryItemBuilder) =>
          item
            .setURL("attachment://price-chart.png")
            .setDescription(
              t.responses.chart_description.replace("{{assetName}}", assetName)
            )
      );

      container.components.push(new SeparatorBuilder(), chartImage);

      await interaction.editReply({
        components: [container],
        files: [attachment],
      });
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
