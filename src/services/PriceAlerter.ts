import { Client } from "discord.js";
import {
  getAllPriceAlerts,
  getAllAssetsWithLatestPrice,
  PriceAlert,
  markUserDeprecationNotified,
  hasUserReceivedDeprecationNotice,
} from "../repositories/asset.repository";
import logger from "../utils/logger";
import { getLocalizations } from "../utils/localization";
import { LocalizationManager } from "./LocalizationManager";
import { CacheService } from "./CacheService";

/**
 * PriceAlerter - DEPRECATED
 * 
 * This service has been deprecated due to Discord policy changes.
 * It now only sends deprecation notices to users when their alerts would have triggered.
 * Each user receives the deprecation notice only once.
 */
export class PriceAlerter {
  private client: Client;
  private localizationManager: LocalizationManager;
  private cacheService: CacheService;
  private isChecking: boolean = false;
  private pendingCheck: boolean = false;
  private lastCheckTime: number = 0;
  private static readonly DEBOUNCE_MS = 5000; // 5 seconds debounce

  constructor(client: Client, localizationManager: LocalizationManager) {
    this.client = client;
    this.localizationManager = localizationManager;
    this.cacheService = CacheService.getInstance();
  }

  public async checkAlerts() {
    // Debounce: skip if we checked recently
    const now = Date.now();
    if (now - this.lastCheckTime < PriceAlerter.DEBOUNCE_MS) {
      return; // Skip this check, too soon
    }

    // If already checking, mark that we need to check again after
    if (this.isChecking) {
      this.pendingCheck = true;
      return;
    }

    this.isChecking = true;
    this.lastCheckTime = now;

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

      const alerts = await getAllPriceAlerts(60);
      if (alerts.length === 0) {
        // Don't log if no alerts - reduces noise
        return;
      }
      logger.info(
        `[PriceAlerter] Checking ${alerts.length} pending alerts (deprecation mode)...`
      );

      // Track users we've already processed in this cycle to avoid duplicate checks
      const processedUsers = new Set<string>();

      for (const alert of alerts) {
        const currentPrice = priceMap.get(alert.asset_symbol);
        if (currentPrice === undefined) {
          continue;
        }

        const conditionMet =
          (alert.condition === "above" && currentPrice > alert.target_price) ||
          (alert.condition === "below" && currentPrice < alert.target_price);

        if (conditionMet && !processedUsers.has(alert.user_id)) {
          processedUsers.add(alert.user_id);

          // Check if user has already received deprecation notice
          const alreadyNotified = await hasUserReceivedDeprecationNotice(alert.user_id);
          if (!alreadyNotified) {
            await this.sendDeprecationNotice(alert);
          }
        }
      }
    } catch (error) {
      logger.error("Error checking price alerts:", error);
    } finally {
      this.isChecking = false;

      // If there was a pending check, schedule it after debounce
      if (this.pendingCheck) {
        this.pendingCheck = false;
        setTimeout(() => this.checkAlerts(), PriceAlerter.DEBOUNCE_MS);
      }
    }
  }

  private async sendDeprecationNotice(alert: PriceAlert) {
    try {
      const user = await this.client.users.fetch(alert.user_id);
      if (!user) {
        logger.warn(`User not found for deprecation notice: ${alert.user_id}`);
        return;
      }

      const translations = getLocalizations(
        this.localizationManager,
        "pricealert"
      );
      const t = translations[alert.locale] || translations["en-US"];

      const message = `${t.notification.deprecation_title}\n\n${t.notification.deprecation_body}`;

      await user.send(message);

      // Mark user as notified
      await markUserDeprecationNotified(alert.user_id);
      logger.info(`[PriceAlerter] Sent deprecation notice to user ${alert.user_id}`);
    } catch (error) {
      const discordError = error as { code?: number };
      if (discordError.code === 50007) {
        logger.warn(
          `[PriceAlerter] Cannot send DM to user ${alert.user_id} (code 50007). Marking as notified anyway.`
        );
        // Mark as notified even if we can't reach them
        await markUserDeprecationNotified(alert.user_id);
        return;
      }
      logger.error(`Failed to send deprecation notice to ${alert.user_id}:`, error);
    }
  }
}
