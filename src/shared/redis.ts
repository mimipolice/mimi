// src/shared/redis.ts
import { createClient, RedisClientType } from "redis";
import logger from "../utils/logger";

type RedisClient = RedisClientType;

let redisClient: RedisClient | null = null;
let connectionPromise: Promise<void> | null = null;

/**
 * 初始化 Redis 連線
 * 使用 Lazy Initialization 確保連線完成後才能使用
 */
function initializeClient(): RedisClient | null {
  if (process.env.REDIS_ENABLED !== "true") {
    return null;
  }

  const client = createClient({
    url: process.env.REDIS_URL,
    password: process.env.REDIS_PASSWORD,
    database: 1,
  });

  client.on("error", (err) => logger.error("Redis Client Error", err));
  client.on("connect", () => logger.debug("Redis client connecting..."));
  client.on("ready", () => {
    logger.info("Successfully connected to Redis.");
  });
  client.on("end", () => {
    logger.info("Redis connection closed.");
  });

  return client as RedisClient;
}

/**
 * 確保 Redis 已連線
 * 返回連線的 client，如果連線失敗或未啟用則返回 null
 */
export async function ensureRedisConnected(): Promise<RedisClient | null> {
  if (process.env.REDIS_ENABLED !== "true") {
    return null;
  }

  // 如果已經連線，直接返回（使用 client.isReady 確保狀態準確）
  if (redisClient && redisClient.isReady) {
    return redisClient;
  }

  // 初始化 client（如果尚未初始化）
  if (!redisClient) {
    redisClient = initializeClient();
  }

  if (!redisClient) {
    return null;
  }

  // 如果 client 存在但尚未連線，檢查是否正在連線中
  if (connectionPromise) {
    await connectionPromise;
    return redisClient.isReady ? redisClient : null;
  }

  // 如果 client 已關閉或未連線，開始連線
  if (!redisClient.isOpen) {
    connectionPromise = (async () => {
      try {
        await redisClient!.connect();
        // 連線成功後清除 promise，允許後續斷線重連
        connectionPromise = null;
      } catch (err) {
        logger.error("Failed to connect to Redis:", err);
        // 重置 connectionPromise 以允許重試連線
        connectionPromise = null;
      }
    })();

    await connectionPromise;
  } else if (redisClient.isOpen && !redisClient.isReady) {
    // 連線中但尚未就緒（理論上罕見，因為 connect() 在 ready 後才 resolve）
    // 短暫等待後再檢查一次
    logger.debug("Redis client is connecting (isOpen=true, isReady=false), waiting briefly...");
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return redisClient.isReady ? redisClient : null;
}

/**
 * 檢查 Redis 是否已連線
 */
export function isRedisConnected(): boolean {
  return redisClient?.isReady ?? false;
}

/**
 * 優雅關閉 Redis 連線
 */
export async function closeRedis(): Promise<void> {
  if (redisClient && redisClient.isOpen) {
    await redisClient.quit();
    redisClient = null;
    connectionPromise = null;
    logger.info("Redis connection closed gracefully.");
  }
}

