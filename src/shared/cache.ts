import logger from "../utils/logger";
import { poolTypeNames } from "../config/gacha";
import { ticketPool } from "./database/index";
import { getKeywordsByGuild } from "./database/queries";
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

let gachaPoolsCache: GachaPool[] = [];
const keywordsCache = new NodeCache({ stdTTL: 3600 });

export async function loadCaches() {
  await loadGachaPools();
  await loadKeywords();
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

async function loadKeywords() {
  try {
    // This is not ideal, but we'll fetch for all guilds for now.
    // This should be refactored to cache per guild.
    const allKeywords = await getKeywordsByGuild(ticketPool, "*");
    keywordsCache.set("keywords", allKeywords);
    logger.debug(`Successfully cached ${allKeywords.length} keywords.`);
  } catch (error) {
    logger.error("Failed to load and cache keywords:", error);
  }
}

export function getGachaPoolsCache(): GachaPool[] {
  return gachaPoolsCache;
}

export function getKeywordsCache(): Keyword[] | undefined {
  return keywordsCache.get<Keyword[]>("keywords");
}

export function flushKeywordsCache() {
  keywordsCache.flushAll();
  logger.debug("Keywords cache flushed.");
  loadKeywords();
}
