// src/services/ChartCacheService.ts

import * as fs from "fs/promises";
import * as path from "path";
import logger from "../utils/logger";

const CACHE_DIR = path.join(process.cwd(), ".cache", "charts");

export class ChartCacheService {
  constructor() {
    this.ensureCacheDirExists();
  }

  private async ensureCacheDirExists(): Promise<void> {
    try {
      await fs.mkdir(CACHE_DIR, { recursive: true });
    } catch (error) {
      logger.error("[ChartCache] Failed to create cache directory:", error);
    }
  }

  public getChartPath(key: string): string {
    return path.join(CACHE_DIR, `${key}.png`);
  }

  public async saveChart(key: string, buffer: Buffer): Promise<string | null> {
    const filePath = this.getChartPath(key);
    try {
      await fs.writeFile(filePath, buffer);
      logger.debug(`[ChartCache] SAVED chart for key: ${key}`);
      return filePath;
    } catch (error) {
      logger.error(`[ChartCache] Error saving chart for key ${key}:`, error);
      return null;
    }
  }

  public async getChart(key: string): Promise<Buffer | null> {
    const filePath = this.getChartPath(key);
    try {
      const buffer = await fs.readFile(filePath);
      logger.debug(`[ChartCache] HIT for chart key: ${key}`);
      return buffer;
    } catch (error) {
      // If the file doesn't exist, it's a cache miss.
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        logger.debug(`[ChartCache] MISS for chart key: ${key}`);
      } else {
        logger.error(`[ChartCache] Error GET for chart key ${key}:`, error);
      }
      return null;
    }
  }

  public async delChart(key: string): Promise<void> {
    const filePath = this.getChartPath(key);
    try {
      await fs.unlink(filePath);
      logger.debug(`[ChartCache] DELETED chart for key: ${key}`);
    } catch (error) {
      // Ignore if file doesn't exist, it might have been deleted manually
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        logger.error(`[ChartCache] Error DEL chart for key ${key}:`, error);
      }
    }
  }
}
