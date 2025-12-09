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
import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { getLocalizations } from "../../../utils/localization";
import logger from "../../../utils/logger";

import { Command, Databases, Services } from "../../../interfaces/Command";

// ---
// Load configs
// ---
const assetListPath = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "config",
  "asset-list.yml"
);
const assetList = yaml.load(fs.readFileSync(assetListPath, "utf8")) as {
  symbol: string;
  name: string;
}[];

// ---
// Transform data for command
// ---
const assetChoices = assetList.map((asset) => ({
  name: `${asset.name} (${asset.symbol})`,
  value: asset.symbol.toLowerCase(),
}));

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
        .setName("set")
        .setDescription("Set a new price alert.")
        .setNameLocalizations({
          [Locale.EnglishUS]: "set",
          [Locale.ChineseTW]: "設定",
        })
        .setDescriptionLocalizations({
          [Locale.EnglishUS]: "Set a new price alert.",
          [Locale.ChineseTW]: "設定新的價格提醒。",
        })
        .addStringOption((option) =>
          option
            .setName("symbol")
            .setDescription("The asset symbol.")
            .setNameLocalizations({
              [Locale.EnglishUS]: "symbol",
              [Locale.ChineseTW]: "股票代號",
            })
            .setDescriptionLocalizations({
              [Locale.EnglishUS]: "The asset symbol.",
              [Locale.ChineseTW]: "資產代號。",
            })
            .setRequired(true)
            .addChoices(...assetChoices.slice(0, 25))
        )
        .addStringOption((option) =>
          option
            .setName("condition")
            .setDescription("The condition for the alert.")
            .setNameLocalizations({
              [Locale.EnglishUS]: "condition",
              [Locale.ChineseTW]: "條件",
            })
            .setDescriptionLocalizations({
              [Locale.EnglishUS]: "The condition for the alert.",
              [Locale.ChineseTW]: "提醒的條件。",
            })
            .setRequired(true)
            .addChoices(
              {
                name: "Above",
                value: "above",
                name_localizations: {
                  [Locale.ChineseTW]: "高於",
                },
              },
              {
                name: "Below",
                value: "below",
                name_localizations: {
                  [Locale.ChineseTW]: "低於",
                },
              }
            )
        )
        .addNumberOption((option) =>
          option
            .setName("price")
            .setDescription("The target price.")
            .setNameLocalizations({
              [Locale.EnglishUS]: "price",
              [Locale.ChineseTW]: "價格",
            })
            .setDescriptionLocalizations({
              [Locale.EnglishUS]: "The target price.",
              [Locale.ChineseTW]: "目標價格。",
            })
            .setRequired(true)
        )
        .addBooleanOption((option) =>
          option
            .setName("repeatable")
            .setDescription("Whether the alert should be repeatable.")
            .setNameLocalizations({
              [Locale.EnglishUS]: "repeatable",
              [Locale.ChineseTW]: "重複",
            })
            .setDescriptionLocalizations({
              [Locale.EnglishUS]: "Whether the alert should be repeatable.",
              [Locale.ChineseTW]: "提醒是否應重複。",
            })
            .setRequired(false)
        )
    )
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

      if (subcommand === "set") {
        // Feature deprecated due to Discord policy changes
        await interaction.editReply(t.deprecated.set_disabled);
        return;
      } else if (subcommand === "list") {
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
      logger.error("Price alert command error:", error);
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
