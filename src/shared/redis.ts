// src/shared/redis.ts
import { createClient } from "redis";
import logger from "../utils/logger";

const redisClient = createClient({
  url: process.env.REDIS_URL, // Your .env file should have REDIS_URL="redis://user:password@host:port"
  database: 1, // Use DB 1 as instructed by your VPS administrator
});

redisClient.on("error", (err) => logger.error("Redis Client Error", err));

(async () => {
  try {
    await redisClient.connect();
    logger.info("Successfully connected to Redis.");
  } catch (err) {
    logger.error("Failed to connect to Redis:", err);
  }
})();

export default redisClient;
