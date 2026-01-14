import {
  SlashCommandBuilder,
  CommandInteraction,
  AutocompleteInteraction,
  Locale,
  Client,
} from "discord.js";
import { MessageFlags } from "discord-api-types/v10";
import {
  getUserPriceAlerts,
  removePriceAlert,
} from "../../../repositories/asset.repository";
import { getLocalizations } from "../../../utils/localization";
import logger from "../../../utils/logger";

import { Command, Databases, Services } from "../../../interfaces/Command";

// ---
// Command
// ---
export default {
  data: new SlashCommandBuilder()
    .setName("pricealert")
    .setDescription("Set a price alert for an asset.")
    .setNameLocalizations({
      [Locale.EnglishUS]: "pricealert",
      [Locale.ChineseTW]: "價格提醒",
    })
    .setDescriptionLocalizations({
      [Locale.EnglishUS]: "Set a price alert for an asset.",
      [Locale.ChineseTW]: "設定資產的價格提醒。",
    })
    .addSubcommand((subcommand) =>
      subcommand
        .setName("list")
        .setDescription("List your price alerts.")
        .setNameLocalizations({
          [Locale.EnglishUS]: "list",
          [Locale.ChineseTW]: "列表",
        })
        .setDescriptionLocalizations({
          [Locale.EnglishUS]: "List your price alerts.",
          [Locale.ChineseTW]: "列出您的價格提醒。",
        })
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("remove")
        .setDescription("Remove a price alert.")
        .setNameLocalizations({
          [Locale.EnglishUS]: "remove",
          [Locale.ChineseTW]: "移除",
        })
        .setDescriptionLocalizations({
          [Locale.EnglishUS]: "Remove a price alert.",
          [Locale.ChineseTW]: "移除價格提醒。",
        })
        .addStringOption((option) =>
          option
            .setName("alert_id")
            .setDescription("The ID of the alert to remove.")
            .setNameLocalizations({
              [Locale.EnglishUS]: "alert_id",
              [Locale.ChineseTW]: "提醒id",
            })
            .setDescriptionLocalizations({
              [Locale.EnglishUS]: "The ID of the alert to remove.",
              [Locale.ChineseTW]: "要移除的提醒id。",
            })
            .setRequired(true)
            .setAutocomplete(true)
        )
    ),

  async autocomplete(interaction: AutocompleteInteraction) {
    try {
      const focusedOption = interaction.options.getFocused(true);

      if (focusedOption.name === "alert_id") {
        const userAlerts = await getUserPriceAlerts(interaction.user.id);
        const choices = userAlerts.map((alert) => {
          const condition = alert.condition === "above" ? "Above" : "Below";
          const name = `#${alert.id}: ${alert.asset_symbol} ${condition} ${alert.target_price}`;
          return { name, value: alert.id.toString() };
        });
        await interaction.respond(choices.slice(0, 25));
      }
    } catch (error) {
      logger.error("Autocomplete error in pricealert:", error);
    }
  },

  async execute(
    interaction: CommandInteraction,
    _client: Client,
    { localizationManager }: Services,
    _databases: Databases
  ) {
    if (!interaction.isChatInputCommand()) return;

    const translations = getLocalizations(localizationManager, "pricealert");
    const t = translations[interaction.locale] || translations["en-US"];

    try {
      // Only defer if not already deferred or replied
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      }

      const subcommand = interaction.options.getSubcommand();
      const userId = interaction.user.id;

      if (subcommand === "list") {
        const alerts = await getUserPriceAlerts(userId);
        if (alerts.length === 0) {
          await interaction.editReply(t.subcommands.list.responses.no_alerts);
          return;
        }

        const alertList = alerts
          .sort((a, b) => a.target_price - b.target_price)
          .map((alert) => {
            const condition = alert.condition === "above" ? ">" : "<";
            return t.subcommands.list.responses.alert_line
              .replace("{{id}}", alert.id.toString())
              .replace("{{assetSymbol}}", alert.asset_symbol)
              .replace("{{condition}}", condition)
              .replace("{{targetPrice}}", alert.target_price.toString())
              .replace(
                "{{timestamp}}",
                Math.floor(alert.created_at.getTime() / 1000).toString()
              );
          })
          .join("\n");

        await interaction.editReply(
          `${t.subcommands.list.responses.title}\n${alertList}`
        );
      } else if (subcommand === "remove") {
        const alertIdString = interaction.options.getString("alert_id", true);
        logger.info(
          `[PriceAlert Remove] Received alert_id string: "${alertIdString}"`
        );
        const alertId = parseInt(alertIdString, 10);
        logger.info(`[PriceAlert Remove] Parsed alertId: ${alertId}`);

        if (isNaN(alertId)) {
          await interaction.editReply(
            t.subcommands.remove.responses.invalid_id
          );
          return;
        }

        const removedCount = await removePriceAlert(alertId, userId);

        if (removedCount > 0) {
          await interaction.editReply(
            t.subcommands.remove.responses.success.replace(
              "{{alertId}}",
              alertId.toString()
            )
          );
        } else {
          await interaction.editReply(
            t.subcommands.remove.responses.not_found.replace(
              "{{alertId}}",
              alertId.toString()
            )
          );
        }
      }
    } catch (error) {
      logger.error(`Price alert command error (by <@${interaction.user.id}> / ${interaction.user.id}):`, error);
      const errorMessage = t.general_error;
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: errorMessage,
          flags: MessageFlags.Ephemeral,
        });
      } else {
        await interaction.followUp({
          content: errorMessage,
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  },
};
