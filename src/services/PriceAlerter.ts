import { Client } from "discord.js";
import {
  getAllPriceAlerts,
  removePriceAlert,
  getAllAssetsWithLatestPrice,
  PriceAlert,
  updatePriceAlertNotified,
} from "../repositories/asset.repository";
import logger from "../utils/logger";
import { getLocalizations } from "../utils/localization";
import { LocalizationManager } from "./LocalizationManager";
import { CacheService } from "./CacheService";

export class PriceAlerter {
  private client: Client;
  private localizationManager: LocalizationManager;
  private cacheService: CacheService;

  constructor(client: Client, localizationManager: LocalizationManager) {
    this.client = client;
    this.localizationManager = localizationManager;
    this.cacheService = new CacheService();
  }

  public async checkAlerts() {
    logger.info("[PriceAlerter] Starting alert check cycle...");
    try {
      let priceMap = await this.cacheService.get<Map<string, number>>(
        "prices:latest"
      );

      if (priceMap && !(priceMap instanceof Map)) {
        priceMap = new Map(Object.entries(priceMap));
      }

      if (!priceMap) {
        const assets = await getAllAssetsWithLatestPrice();
        priceMap = new Map(
          assets.map((asset) => [asset.asset_symbol, asset.price])
        );
        await this.cacheService.set(
          "prices:latest",
          Object.fromEntries(priceMap),
          60
        );
      }

      // Since this is now event-driven, we can check for any alert
      // that hasn't been notified in the last minute to avoid spam,
      // but still be highly responsive. A 60-second cooldown is reasonable.
      const alerts = await getAllPriceAlerts(60);
      if (alerts.length === 0) {
        logger.info("[PriceAlerter] No pending alerts found.");
        return;
      }
      logger.info(
        `[PriceAlerter] Found ${alerts.length} pending alerts to check.`
      );

      for (const alert of alerts) {
        const currentPrice = priceMap.get(alert.asset_symbol);
        if (currentPrice === undefined) {
          logger.warn(
            `[PriceAlerter] No price found for symbol ${alert.asset_symbol} for alert #${alert.id}. Skipping.`
          );
          continue;
        }

        const conditionMet =
          (alert.condition === "above" && currentPrice > alert.target_price) ||
          (alert.condition === "below" && currentPrice < alert.target_price);

        if (conditionMet) {
          logger.info(
            `[PriceAlerter] Alert #${alert.id} triggered for ${alert.asset_symbol}. Condition: ${alert.condition} ${alert.target_price}, Current Price: ${currentPrice}.`
          );
          await this.sendNotification(alert, currentPrice);
          // First, always update the notified timestamp to prevent immediate re-triggering
          logger.info(
            `[PriceAlerter] Updating timestamp for alert #${alert.id}.`
          );
          await updatePriceAlertNotified(alert.id);

          // If the alert is not repeatable, then attempt to remove it.
          if (!alert.repeatable) {
            logger.info(
              `[PriceAlerter] Removing non-repeatable alert #${alert.id}.`
            );
            try {
              await removePriceAlert(alert.id, alert.user_id);
            } catch (removeError) {
              logger.error(
                `[PriceAlerter] Failed to remove non-repeatable alert #${alert.id} after notification. It will be cleaned up by a separate process.`,
                removeError
              );
            }
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

      const translations = getLocalizations(
        this.localizationManager,
        "pricealert"
      );
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
    } catch (error) {
      logger.error(`Failed to send price alert DM to ${alert.user_id}:`, error);
    }
  }
}
