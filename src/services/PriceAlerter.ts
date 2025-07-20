import { Client } from "discord.js";
import { Pool } from "pg";
import {
  getAllPriceAlerts,
  updatePriceAlertNotified,
  getAllAssetsWithLatestPrice,
  PriceAlert,
} from "../shared/database/queries";
import logger from "../utils/logger";

export class PriceAlerter {
  private client: Client;
  private pool: Pool;
  private interval: NodeJS.Timeout | null = null;

  constructor(client: Client, pool: Pool) {
    this.client = client;
    this.pool = pool;
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
      const alerts = await getAllPriceAlerts(this.pool);
      if (alerts.length === 0) {
        return;
      }

      const assets = await getAllAssetsWithLatestPrice(this.pool);
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
          await updatePriceAlertNotified(this.pool, alert.id);
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

      const message = `🔔 **股價提醒** 🔔\n您設定的 **${
        alert.asset_symbol
      }** 價格提醒已觸發！\n\n> **條件:** ${
        alert.condition === "above" ? "高於" : "低於"
      } ${alert.target_price}\n> **目前價格:** ${currentPrice.toFixed(2)}`;

      await user.send(message);
      logger.info(`Sent price alert notification to ${user.tag}`);
    } catch (error) {
      logger.error(`Failed to send price alert DM to ${alert.user_id}:`, error);
    }
  }
}
