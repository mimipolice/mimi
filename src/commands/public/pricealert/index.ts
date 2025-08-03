import {
  SlashCommandBuilder,
  CommandInteraction,
  AutocompleteInteraction,
  Locale,
  Client,
} from "discord.js";
import { MessageFlags } from "discord-api-types/v10";
import {
  createPriceAlert,
  getUserPriceAlerts,
  removePriceAlert,
  getAllAssetsWithLatestPrice,
  findNextAvailablePriceAlertId,
} from "../../../shared/database/queries";
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

const translations = getLocalizations("pricealert");

// ---
// Transform data for command
// ---
const assetChoices = assetList.map((asset) => ({
  name: `${asset.name} (${asset.symbol})`,
  value: asset.symbol.toLowerCase(),
}));

const nameLocalizations = {
  [Locale.EnglishUS]: translations["en-US"].name,
  [Locale.ChineseTW]: translations["zh-TW"].name,
};
const descriptionLocalizations = {
  [Locale.EnglishUS]: translations["en-US"].description,
  [Locale.ChineseTW]: translations["zh-TW"].description,
};

// ---
// Command
// ---
export default {
  data: new SlashCommandBuilder()
    .setName(translations["en-US"].name)
    .setDescription(translations["en-US"].description)
    .setNameLocalizations(nameLocalizations)
    .setDescriptionLocalizations(descriptionLocalizations)
    .addSubcommand((subcommand) =>
      subcommand
        .setName(translations["en-US"].subcommands.set.name)
        .setDescription(translations["en-US"].subcommands.set.description)
        .setNameLocalizations({
          [Locale.EnglishUS]: translations["en-US"].subcommands.set.name,
          [Locale.ChineseTW]: translations["zh-TW"].subcommands.set.name,
        })
        .setDescriptionLocalizations({
          [Locale.EnglishUS]: translations["en-US"].subcommands.set.description,
          [Locale.ChineseTW]: translations["zh-TW"].subcommands.set.description,
        })
        .addStringOption((option) =>
          option
            .setName(translations["en-US"].subcommands.set.options.symbol.name)
            .setDescription(
              translations["en-US"].subcommands.set.options.symbol.description
            )
            .setNameLocalizations({
              [Locale.EnglishUS]:
                translations["en-US"].subcommands.set.options.symbol.name,
              [Locale.ChineseTW]:
                translations["zh-TW"].subcommands.set.options.symbol.name,
            })
            .setDescriptionLocalizations({
              [Locale.EnglishUS]:
                translations["en-US"].subcommands.set.options.symbol
                  .description,
              [Locale.ChineseTW]:
                translations["zh-TW"].subcommands.set.options.symbol
                  .description,
            })
            .setRequired(true)
            .addChoices(...assetChoices.slice(0, 25))
        )
        .addStringOption((option) =>
          option
            .setName(
              translations["en-US"].subcommands.set.options.condition.name
            )
            .setDescription(
              translations["en-US"].subcommands.set.options.condition
                .description
            )
            .setNameLocalizations({
              [Locale.EnglishUS]:
                translations["en-US"].subcommands.set.options.condition.name,
              [Locale.ChineseTW]:
                translations["zh-TW"].subcommands.set.options.condition.name,
            })
            .setDescriptionLocalizations({
              [Locale.EnglishUS]:
                translations["en-US"].subcommands.set.options.condition
                  .description,
              [Locale.ChineseTW]:
                translations["zh-TW"].subcommands.set.options.condition
                  .description,
            })
            .setRequired(true)
            .addChoices(
              {
                name: translations["en-US"].subcommands.set.options.condition
                  .choices.above,
                value: "above",
                name_localizations: {
                  [Locale.ChineseTW]:
                    translations["zh-TW"].subcommands.set.options.condition
                      .choices.above,
                },
              },
              {
                name: translations["en-US"].subcommands.set.options.condition
                  .choices.below,
                value: "below",
                name_localizations: {
                  [Locale.ChineseTW]:
                    translations["zh-TW"].subcommands.set.options.condition
                      .choices.below,
                },
              }
            )
        )
        .addNumberOption((option) =>
          option
            .setName(translations["en-US"].subcommands.set.options.price.name)
            .setDescription(
              translations["en-US"].subcommands.set.options.price.description
            )
            .setNameLocalizations({
              [Locale.EnglishUS]:
                translations["en-US"].subcommands.set.options.price.name,
              [Locale.ChineseTW]:
                translations["zh-TW"].subcommands.set.options.price.name,
            })
            .setDescriptionLocalizations({
              [Locale.EnglishUS]:
                translations["en-US"].subcommands.set.options.price.description,
              [Locale.ChineseTW]:
                translations["zh-TW"].subcommands.set.options.price.description,
            })
            .setRequired(true)
        )
        .addBooleanOption((option) =>
          option
            .setName(
              translations["en-US"].subcommands.set.options.repeatable.name
            )
            .setDescription(
              translations["en-US"].subcommands.set.options.repeatable
                .description
            )
            .setNameLocalizations({
              [Locale.EnglishUS]:
                translations["en-US"].subcommands.set.options.repeatable.name,
              [Locale.ChineseTW]:
                translations["zh-TW"].subcommands.set.options.repeatable.name,
            })
            .setDescriptionLocalizations({
              [Locale.EnglishUS]:
                translations["en-US"].subcommands.set.options.repeatable
                  .description,
              [Locale.ChineseTW]:
                translations["zh-TW"].subcommands.set.options.repeatable
                  .description,
            })
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName(translations["en-US"].subcommands.list.name)
        .setDescription(translations["en-US"].subcommands.list.description)
        .setNameLocalizations({
          [Locale.EnglishUS]: translations["en-US"].subcommands.list.name,
          [Locale.ChineseTW]: translations["zh-TW"].subcommands.list.name,
        })
        .setDescriptionLocalizations({
          [Locale.EnglishUS]:
            translations["en-US"].subcommands.list.description,
          [Locale.ChineseTW]:
            translations["zh-TW"].subcommands.list.description,
        })
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName(translations["en-US"].subcommands.remove.name)
        .setDescription(translations["en-US"].subcommands.remove.description)
        .setNameLocalizations({
          [Locale.EnglishUS]: translations["en-US"].subcommands.remove.name,
          [Locale.ChineseTW]: translations["zh-TW"].subcommands.remove.name,
        })
        .setDescriptionLocalizations({
          [Locale.EnglishUS]:
            translations["en-US"].subcommands.remove.description,
          [Locale.ChineseTW]:
            translations["zh-TW"].subcommands.remove.description,
        })
        .addStringOption((option) =>
          option
            .setName(
              translations["en-US"].subcommands.remove.options.alert_id.name
            )
            .setDescription(
              translations["en-US"].subcommands.remove.options.alert_id
                .description
            )
            .setNameLocalizations({
              [Locale.EnglishUS]:
                translations["en-US"].subcommands.remove.options.alert_id.name,
              [Locale.ChineseTW]:
                translations["zh-TW"].subcommands.remove.options.alert_id.name,
            })
            .setDescriptionLocalizations({
              [Locale.EnglishUS]:
                translations["en-US"].subcommands.remove.options.alert_id
                  .description,
              [Locale.ChineseTW]:
                translations["zh-TW"].subcommands.remove.options.alert_id
                  .description,
            })
            .setRequired(true)
            .setAutocomplete(true)
        )
    ),

  async autocomplete(interaction: AutocompleteInteraction) {
    try {
      const focusedOption = interaction.options.getFocused(true);
      const t = translations[interaction.locale] || translations["en-US"];

      if (focusedOption.name === "alert_id") {
        const userAlerts = await getUserPriceAlerts(interaction.user.id);
        const choices = userAlerts.map((alert) => {
          const condition =
            alert.condition === "above"
              ? t.subcommands.set.options.condition.choices.above
              : t.subcommands.set.options.condition.choices.below;
          const name = t.autocomplete.alert_id_choice
            .replace("{{id}}", alert.id.toString())
            .replace("{{assetSymbol}}", alert.asset_symbol)
            .replace("{{condition}}", condition)
            .replace("{{targetPrice}}", alert.target_price.toString());
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
    _services: Services,
    _databases: Databases
  ) {
    if (!interaction.isChatInputCommand()) return;

    const t = translations[interaction.locale] || translations["en-US"];

    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const subcommand = interaction.options.getSubcommand();
      const userId = interaction.user.id;

      if (subcommand === "set") {
        const symbol = interaction.options.getString(
          t.subcommands.set.options.symbol.name,
          true
        );
        const condition = interaction.options.getString(
          t.subcommands.set.options.condition.name,
          true
        ) as "above" | "below";
        const targetPrice = interaction.options.getNumber(
          t.subcommands.set.options.price.name,
          true
        );
        const repeatable =
          interaction.options.getBoolean(
            t.subcommands.set.options.repeatable.name
          ) ?? false;

        const asset = assetList.find((a) => a.symbol.toLowerCase() === symbol);

        if (!asset) {
          await interaction.editReply(
            t.subcommands.set.responses.asset_not_found.replace(
              "{{symbol}}",
              symbol
            )
          );
          return;
        }

        // --- Get current price ---
        const allAssets = await getAllAssetsWithLatestPrice();
        const currentAsset = allAssets.find(
          (a) => a.asset_symbol === asset.symbol
        );
        const currentPrice = currentAsset ? currentAsset.price : null;

        // --- Create alert ---
        const nextId = await findNextAvailablePriceAlertId(userId);
        await createPriceAlert(
          nextId,
          userId,
          asset.symbol,
          condition,
          targetPrice,
          repeatable,
          interaction.locale
        );

        // --- Respond with details ---
        const conditionText =
          condition === "above"
            ? t.subcommands.set.options.condition.choices.above
            : t.subcommands.set.options.condition.choices.below;

        let reply;
        if (currentPrice !== null) {
          reply = t.subcommands.set.responses.success
            .replace("{{assetName}}", asset.name)
            .replace("{{assetSymbol}}", asset.symbol)
            .replace("{{condition}}", conditionText)
            .replace("{{targetPrice}}", targetPrice.toString())
            .replace("{{currentPrice}}", currentPrice.toFixed(2));
        } else {
          reply = t.subcommands.set.responses.no_current_price
            .replace("{{assetName}}", asset.name)
            .replace("{{assetSymbol}}", asset.symbol)
            .replace("{{condition}}", conditionText)
            .replace("{{targetPrice}}", targetPrice.toString());
        }

        await interaction.editReply(reply);
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
        const alertId = parseInt(
          interaction.options.getString(
            t.subcommands.remove.options.alert_id.name,
            true
          ),
          10
        );
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
