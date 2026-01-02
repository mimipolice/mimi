// src/services/CacheService.ts

import redisClient from "../shared/redis";
import logger from "../utils/logger";

const DEFAULT_TTL_SECONDS = 3600; // 1 hour default TTL

export class CacheService {
  // 獲取一個 JSON 物件或任何字串
  public async get<T>(key: string): Promise<T | null> {
    if (!redisClient) return null;
    try {
      const data = await redisClient.get(key);
      if (data) {
        logger.debug(`[Cache] HIT for ${key}`);
        return JSON.parse(data) as T;
      }
      logger.debug(`[Cache] MISS for ${key}`);
      return null;
    } catch (error) {
      logger.error(`[Cache] Error GET for ${key}:`, error);
      return null;
    }
  }

  // 設置一個值，可以是物件或字串
  public async set<T>(
    key: string,
    value: T,
    ttl: number = DEFAULT_TTL_SECONDS
  ): Promise<void> {
    if (!redisClient) return;
    try {
      const stringValue = JSON.stringify(value);
      await redisClient.set(key, stringValue, { EX: ttl });
      logger.debug(`[Cache] SET for ${key}`);
    } catch (error) {
      logger.error(`[Cache] Error SET for ${key}:`, error);
    }
  }

  // 刪除一個或多個 key
  public async del(keys: string | string[]): Promise<void> {
    if (!redisClient) return;
    try {
      await redisClient.del(keys);
      const keysToDelete = Array.isArray(keys) ? keys.join(", ") : keys;
      logger.debug(`[Cache] DELETED for ${keysToDelete}`);
    } catch (error) {
      const keysToDelete = Array.isArray(keys) ? keys.join(", ") : keys;
      logger.error(`[Cache] Error DEL for ${keysToDelete}:`, error);
    }
  }

  // 清除所有快取 (謹慎使用!)
  public async flushAll(): Promise<void> {
    if (!redisClient) return;
    try {
      await redisClient.flushDb();
      logger.warn(`[Cache] FLUSHED entire cache database.`);
    } catch (error) {
      logger.error(`[Cache] Error FLUSHING cache:`, error);
    }
  }
}
