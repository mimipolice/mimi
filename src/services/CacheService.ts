// src/services/CacheService.ts

import { ensureRedisConnected } from "../shared/redis";
import logger from "../utils/logger";

const DEFAULT_TTL_SECONDS = 3600; // 1 hour default TTL

/**
 * CacheService - Redis 快取服務
 *
 * 使用單例模式確保整個應用程式只有一個實例
 * 所有方法都有防禦性設計，在 Redis 不可用時優雅降級
 */
export class CacheService {
  private static instance: CacheService | null = null;

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {}

  /**
   * 獲取 CacheService 單例
   */
  public static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  /**
   * 重置單例實例（僅供測試使用）
   * @internal
   */
  public static resetInstance(): void {
    CacheService.instance = null;
  }

  /**
   * 獲取一個 JSON 物件或任何字串
   */
  public async get<T>(key: string): Promise<T | null> {
    const client = await ensureRedisConnected();
    if (!client) return null;
    try {
      const data = await client.get(key);
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

  /**
   * 設置一個值，可以是物件或字串
   */
  public async set<T>(
    key: string,
    value: T,
    ttl: number = DEFAULT_TTL_SECONDS
  ): Promise<void> {
    const client = await ensureRedisConnected();
    if (!client) return;
    try {
      const stringValue = JSON.stringify(value);
      await client.set(key, stringValue, { EX: ttl });
      logger.debug(`[Cache] SET for ${key}`);
    } catch (error) {
      logger.error(`[Cache] Error SET for ${key}:`, error);
    }
  }

  /**
   * 刪除一個或多個 key
   */
  public async del(keys: string | string[]): Promise<void> {
    const client = await ensureRedisConnected();
    if (!client) return;
    try {
      await client.del(keys);
      const keysToDelete = Array.isArray(keys) ? keys.join(", ") : keys;
      logger.debug(`[Cache] DELETED for ${keysToDelete}`);
    } catch (error) {
      const keysToDelete = Array.isArray(keys) ? keys.join(", ") : keys;
      logger.error(`[Cache] Error DEL for ${keysToDelete}:`, error);
    }
  }

  /**
   * 清除所有快取 (謹慎使用!)
   */
  public async flushAll(): Promise<void> {
    const client = await ensureRedisConnected();
    if (!client) return;
    try {
      await client.flushDb();
      logger.warn(`[Cache] FLUSHED entire cache database.`);
    } catch (error) {
      logger.error(`[Cache] Error FLUSHING cache:`, error);
    }
  }
}

/**
 * 預設匯出單例實例
 * 方便使用：import cacheService from './CacheService'
 */
export const cacheService = CacheService.getInstance();
