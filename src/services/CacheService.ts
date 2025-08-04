// src/services/CacheService.ts
import redisClient from "../shared/redis";
import logger from "../utils/logger";

const DEFAULT_TTL_SECONDS = 300; // Default 5 minutes

export class CacheService {
  public async getUserInfo(userId: string): Promise<any | null> {
    const key = `userinfo:${userId}`;
    try {
      const data = await redisClient.json.get(key);
      if (data) {
        logger.debug(`[Cache] HIT for ${key}`);
        return data;
      }
      logger.debug(`[Cache] MISS for ${key}`);
      return null;
    } catch (error) {
      logger.error(`[Cache] Error GET for ${key}:`, error);
      return null;
    }
  }

  public async setUserInfo(userId: string, data: any): Promise<void> {
    const key = `userinfo:${userId}`;
    try {
      // Use RedisJSON's json.set
      // '$' represents the root path
      await redisClient.json.set(key, "$", data);
      await redisClient.expire(key, DEFAULT_TTL_SECONDS);
      logger.debug(`[Cache] SET for ${key}`);
    } catch (error) {
      logger.error(`[Cache] Error SET for ${key}:`, error);
    }
  }

  public async invalidateUserInfo(userId: string): Promise<void> {
    const key = `userinfo:${userId}`;
    try {
      // Use json.del to delete the entire JSON object
      await redisClient.json.del(key);
      logger.info(`[Cache] INVALIDATED for ${key}`);
    } catch (error) {
      logger.error(`[Cache] Error INVALIDATE for ${key}:`, error);
    }
  }
}
