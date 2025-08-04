import { Client } from "discord.js";
import {
  getAllPriceAlerts,
  removePriceAlert,
  getAllAssetsWithLatestPrice,
  PriceAlert,
  updatePriceAlertNotified,
} from "../shared/database/queries";
import logger from "../utils/logger";
import { getLocalizations } from "../utils/localization";
import { LocalizationManager } from "./LocalizationManager";
import { CacheService } from "./CacheService";

export class PriceAlerter {
  private client: Client;
  private interval: NodeJS.Timeout | null = null;
  private localizationManager: LocalizationManager;
  private cacheService: CacheService;

  constructor(client: Client, localizationManager: LocalizationManager) {
    this.client = client;
    this.localizationManager = localizationManager;
    this.cacheService = new CacheService();
  }

  public start(checkIntervalMs: number = 120000) {
    if (this.interval) {
      this.stop();
    }
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
      let priceMap = await this.cacheService.get<Map<string, number>>(
        "prices:latest"
      );

      if (!priceMap) {
        const assets = await getAllAssetsWithLatestPrice();
        priceMap = new Map(
          assets.map((asset) => [asset.asset_symbol, asset.price])
        );
        await this.cacheService.set("prices:latest", priceMap, 60);
      }

      const alerts = await getAllPriceAlerts();
      if (alerts.length === 0) {
        return;
      }

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
