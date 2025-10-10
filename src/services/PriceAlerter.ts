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
          if (!alert.repeatable) {
            // ATOMIC ACTION: Try to delete the alert. If we succeed (count > 0), we own it.
            const removedCount = await removePriceAlert(
              alert.id,
              alert.user_id
            );
            if (removedCount > 0) {
              logger.info(
                `[PriceAlerter] Atomically removed alert #${alert.id}. Sending notification.`
              );
              await this.sendNotification(alert, currentPrice);
            } else {
              logger.debug(
                `[PriceAlerter] Alert #${alert.id} was already removed by another process. Skipping notification.`
              );
            }
          } else {
            // ATOMIC ACTION: Try to update the timestamp. If we succeed (count > 0), we own it.
            const updatedCount = await updatePriceAlertNotified(alert.id);
            if (updatedCount > 0) {
              logger.info(
                `[PriceAlerter] Atomically updated timestamp for alert #${alert.id}. Sending notification.`
              );
              await this.sendNotification(alert, currentPrice);
            } else {
              logger.debug(
                `[PriceAlerter] Alert #${alert.id} was already updated by another process. Skipping notification.`
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
