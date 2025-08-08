// src/services/CacheInvalidationService.ts

import { PoolClient } from "pg";
import * as fs from "fs/promises";
import * as path from "path";
import { gachaPool } from "../shared/database";
import redisClient from "../shared/redis";
import logger from "../utils/logger";
import { CacheService } from "./CacheService";
import { ChartCacheService } from "./ChartCacheService";

const CHART_CACHE_DIR = path.join(process.cwd(), ".cache", "charts");

export class CacheInvalidationService {
  private listenClient: PoolClient | null = null;
  private cacheService: CacheService;
  private chartCacheService: ChartCacheService;

  constructor() {
    this.cacheService = new CacheService();
    this.chartCacheService = new ChartCacheService();
    logger.info("[CacheInvalidator] Service initialized.");
  }

  public async startListening(): Promise<void> {
    try {
      this.listenClient = await gachaPool.connect();
      await this.listenClient.query("LISTEN cache_invalidation");
      logger.info(
        "[CacheInvalidator] Now listening for 'cache_invalidation' notifications from PostgreSQL."
      );

      this.listenClient.on("notification", (msg) => {
        if (msg.payload) {
          logger.debug(
            `[CacheInvalidator] Received notification for symbol: ${msg.payload}`
          );
          this.invalidateCacheForSymbol(msg.payload);
        }
      });

      this.listenClient.on("error", (err) => {
        logger.error("[CacheInvalidator] Listener client error:", err);
        this.stopListening();
        setTimeout(() => this.startListening(), 5000); // Retry after 5s
      });
    } catch (error) {
      logger.error("[CacheInvalidator] Failed to start listening:", error);
    }
  }

  private async invalidateCacheForSymbol(symbol: string): Promise<void> {
    // 1. Invalidate Redis data cache
    if (redisClient) {
      const redisScanKey = `report-data:${symbol}:*`;
      let cursor = "0";
      try {
        do {
          const reply = await redisClient.scan(cursor, {
            MATCH: redisScanKey,
            COUNT: 100,
          });
          cursor = reply.cursor;
          const keys = reply.keys;
          if (keys.length > 0) {
            logger.debug(
              `[CacheInvalidator] Deleting Redis keys for pattern "${redisScanKey}":`,
              keys
            );
            await this.cacheService.del(keys);
          }
        } while (cursor !== "0");
      } catch (error) {
        logger.error(
          `[CacheInvalidator] Error scanning/deleting Redis keys for symbol ${symbol}:`,
          error
        );
      }
    }

    // 2. Invalidate filesystem chart cache
    try {
      const chartFilePrefix = `report-chart:${symbol}:`;
      const files = await fs.readdir(CHART_CACHE_DIR);
      const filesToDelete = files.filter((file) =>
        file.startsWith(chartFilePrefix)
      );

      if (filesToDelete.length > 0) {
        logger.debug(
          `[CacheInvalidator] Deleting chart cache files for symbol ${symbol}:`,
          filesToDelete
        );
        for (const file of filesToDelete) {
          // Extract the key from the filename (e.g., "report-chart:AZGC:7d.png" -> "report-chart:AZGC:7d")
          const key = path.parse(file).name;
          await this.chartCacheService.delChart(key);
        }
      }
    } catch (error) {
      // If the directory doesn't exist, there's nothing to do.
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return;
      }
      logger.error(
        `[CacheInvalidator] Error reading chart cache directory for symbol ${symbol}:`,
        error
      );
    }
  }

  public stopListening(): void {
    if (this.listenClient) {
      this.listenClient.release();
      this.listenClient = null;
      logger.info("[CacheInvalidator] Stopped listening for notifications.");
    }
  }
}
