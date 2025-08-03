import logger from "../utils/logger";
import { poolTypeNames } from "../config/gacha";
import { mimiDLCDb } from "./database/index";
import {
  getKeywordsByGuild as dbGetKeywordsByGuild,
  getAutoreacts as dbGetAutoreactsByGuild,
} from "./database/queries";
import NodeCache from "node-cache";

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
const keywordsCache = new NodeCache({ stdTTL: 3600 });
const autoreactsCache = new NodeCache({ stdTTL: 3600 });

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
    logger.debug(`Successfully cached ${gachaPoolsCache.length} gacha pools.`);
  } catch (error) {
    logger.error("Failed to load and cache gacha pools:", error);
  }
}

export function getGachaPoolsCache(): GachaPool[] {
  return gachaPoolsCache;
}

export async function getKeywordsForGuild(guildId: string): Promise<Keyword[]> {
  const cacheKey = `keywords:${guildId}`;
  const cachedKeywords = keywordsCache.get<Keyword[]>(cacheKey);
  if (cachedKeywords) {
    logger.debug(`Cache hit for keywords in guild ${guildId}.`);
    return cachedKeywords;
  }

  logger.debug(
    `Cache miss for keywords in guild ${guildId}. Fetching from DB.`
  );
  const keywords = await dbGetKeywordsByGuild(mimiDLCDb, guildId);
  keywordsCache.set(cacheKey, keywords);
  return keywords;
}

export function flushKeywordsCacheForGuild(guildId: string) {
  const cacheKey = `keywords:${guildId}`;
  keywordsCache.del(cacheKey);
  logger.debug(`Keywords cache flushed for guild ${guildId}.`);
}

export async function getAutoreactsForGuild(
  guildId: string
): Promise<Autoreact[]> {
  const cacheKey = `autoreacts:${guildId}`;
  const cachedAutoreacts = autoreactsCache.get<Autoreact[]>(cacheKey);
  if (cachedAutoreacts) {
    logger.debug(`Cache hit for autoreacts in guild ${guildId}.`);
    return cachedAutoreacts;
  }

  logger.debug(
    `Cache miss for autoreacts in guild ${guildId}. Fetching from DB.`
  );
  const autoreacts = await dbGetAutoreactsByGuild(mimiDLCDb, guildId);
  autoreactsCache.set(cacheKey, autoreacts);
  return autoreacts;
}

export function flushAutoreactsForGuild(guildId: string) {
  const cacheKey = `autoreacts:${guildId}`;
  autoreactsCache.del(cacheKey);
  logger.debug(`Autoreacts cache flushed for guild ${guildId}.`);
}

export function flushCaches() {
  keywordsCache.flushAll();
  autoreactsCache.flushAll();
  logger.debug("All caches flushed.");
}

export function flushKeywordsCache() {
  keywordsCache.flushAll();
  logger.debug("Keywords cache flushed.");
}
