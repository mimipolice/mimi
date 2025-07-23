import { Client, Locale } from "discord.js";
import { gachaPool } from "../shared/database";
import {
  getAllPriceAlerts,
  removePriceAlert,
  getAllAssetsWithLatestPrice,
  PriceAlert,
  updatePriceAlertNotified,
} from "../shared/database/queries";
import logger from "../utils/logger";
import { getLocalizations } from "../utils/localization";

const translations = getLocalizations("pricealert");

export class PriceAlerter {
  private client: Client;
  private interval: NodeJS.Timeout | null = null;

  constructor(client: Client) {
    this.client = client;
  }

  public start(checkIntervalMs: number = 60000) {
    if (this.interval) {
      this.stop();
    }
    logger.info("PriceAlerter started.");
    this.interval = setInterval(() => this.checkAlerts(), checkIntervalMs);
  }

  public stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      logger.info("PriceAlerter stopped.");
    }
  }

  private async checkAlerts() {
    try {
      const alerts = await getAllPriceAlerts();
      if (alerts.length === 0) {
        return;
      }

      const assets = await getAllAssetsWithLatestPrice(gachaPool);
      const priceMap = new Map(
        assets.map((asset) => [asset.asset_symbol, asset.price])
      );

      for (const alert of alerts) {
        const currentPrice = priceMap.get(alert.asset_symbol);
        if (currentPrice === undefined) {
          continue;
        }

        const conditionMet =
          (alert.condition === "above" && currentPrice > alert.target_price) ||
          (alert.condition === "below" && currentPrice < alert.target_price);

        if (conditionMet) {
          await this.sendNotification(alert, currentPrice);
          if (alert.repeatable) {
            await updatePriceAlertNotified(alert.id);
          } else {
            await removePriceAlert(alert.id, alert.user_id);
          }
        }
      }
    } catch (error) {
      logger.error("Error checking price alerts:", error);
    }
  }

  private async sendNotification(alert: PriceAlert, currentPrice: number) {
    try {
      const user = await this.client.users.fetch(alert.user_id);
      if (!user) {
        logger.warn(`User not found for price alert: ${alert.user_id}`);
        return;
      }

      const t = translations[alert.locale] || translations["en-US"];

      const conditionText =
        alert.condition === "above"
          ? t.subcommands.set.options.condition.choices.above
          : t.subcommands.set.options.condition.choices.below;

      const message =
        `${t.notification.title}\n` +
        t.notification.body
          .replace("{{assetSymbol}}", alert.asset_symbol)
          .replace("{{condition}}", conditionText)
          .replace("{{targetPrice}}", alert.target_price.toString())
          .replace("{{currentPrice}}", currentPrice.toFixed(2));

      await user.send(message);
      logger.info(`Sent price alert notification to ${user.tag}`);
    } catch (error) {
      logger.error(`Failed to send price alert DM to ${alert.user_id}:`, error);
    }
  }
}
