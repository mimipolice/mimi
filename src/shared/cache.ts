import logger from "../utils/logger";
import { poolTypeNames } from "../config/gacha";
import { mimiDLCDb } from "./database/index";
import {
  getKeywordsByGuild as dbGetKeywordsByGuild,
  getAutoreacts as dbGetAutoreactsByGuild,
  getAntiSpamSettings as dbGetAntiSpamSettings,
  AntiSpamSettings,
} from "../repositories/admin.repository";
import { CacheService } from "../services/CacheService";

const cacheService = new CacheService();

// Define the type based on the expected structure
export interface GachaPool {
  gacha_id: string;
  gacha_name: string;
  gacha_name_alias: string;
}

export interface Keyword {
  id: number;
  guild_id: string;
  keyword: string;
  reply: string;
  match_type: "exact" | "contains";
}

export interface Autoreact {
  channel_id: string;
  emoji: string;
}

let gachaPoolsCache: GachaPool[] = [];

export async function loadCaches() {
  await loadGachaPools();
}

async function loadGachaPools() {
  try {
    gachaPoolsCache = Object.entries(poolTypeNames).map(([id, name]) => ({
      gacha_id: id,
      gacha_name: name,
      gacha_name_alias: name,
    }));
    logger.info(`Successfully cached ${gachaPoolsCache.length} gacha pools.`);
  } catch (error) {
    logger.error("Failed to load and cache gacha pools:", error);
  }
}

export function getGachaPoolsCache(): GachaPool[] {
  return gachaPoolsCache;
}

export async function getKeywordsForGuild(guildId: string): Promise<Keyword[]> {
  const cacheKey = `keywords:${guildId}`;
  const cached = await cacheService.get<Keyword[]>(cacheKey);
  if (cached) {
    logger.debug(`Cache hit for keywords in guild ${guildId}.`);
    return cached;
  }

  logger.debug(
    `Cache miss for keywords in guild ${guildId}. Fetching from DB.`
  );
  const keywords = await dbGetKeywordsByGuild(mimiDLCDb, guildId);
  await cacheService.set(cacheKey, keywords);
  return keywords;
}

export async function flushKeywordsCacheForGuild(guildId: string) {
  const cacheKey = `keywords:${guildId}`;
  await cacheService.del(cacheKey);
  logger.debug(`Keywords cache flushed for guild ${guildId}.`);
}

export async function getAutoreactsForGuild(
  guildId: string
): Promise<Autoreact[]> {
  const cacheKey = `autoreacts:${guildId}`;
  const cached = await cacheService.get<Autoreact[]>(cacheKey);
  if (cached) {
    logger.debug(`Cache hit for autoreacts in guild ${guildId}.`);
    return cached;
  }

  logger.debug(
    `Cache miss for autoreacts in guild ${guildId}. Fetching from DB.`
  );
  const autoreacts = await dbGetAutoreactsByGuild(mimiDLCDb, guildId);
  await cacheService.set(cacheKey, autoreacts);
  return autoreacts;
}

export async function flushAutoreactsForGuild(guildId: string) {
  const cacheKey = `autoreacts:${guildId}`;
  await cacheService.del(cacheKey);
  logger.debug(`Autoreacts cache flushed for guild ${guildId}.`);
}

export async function getAntiSpamSettingsForGuild(
  guildId: string
): Promise<AntiSpamSettings | null> {
  const cacheKey = `antiSpamSettings:${guildId}`;
  const cached = await cacheService.get<AntiSpamSettings>(cacheKey);
  if (cached) {
    logger.debug(`Cache hit for anti-spam settings in guild ${guildId}.`);
    return cached;
  }

  logger.debug(
    `Cache miss for anti-spam settings in guild ${guildId}. Fetching from DB.`
  );
  const settings = await dbGetAntiSpamSettings(guildId);
  if (settings) {
    await cacheService.set(cacheKey, settings);
  }
  return settings;
}

export async function flushAntiSpamSettingsForGuild(guildId: string) {
  const cacheKey = `antiSpamSettings:${guildId}`;
  await cacheService.del(cacheKey);
  logger.debug(`Anti-spam settings cache flushed for guild ${guildId}.`);
}

export async function flushCaches() {
  await cacheService.flushAll();
  logger.debug("All caches flushed.");
}

export async function flushKeywordsCache() {
  // This is more complex as we don't have a direct way to flush only keyword caches
  // without a pattern. For now, we'll leave this as a broader flush.
  // A better implementation would be to iterate and delete keys with a "keywords:" prefix.
  await cacheService.flushAll(); // Or implement a pattern-based deletion in CacheService
  logger.debug("Keywords cache flushed.");
}
