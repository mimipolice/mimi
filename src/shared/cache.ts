import logger from "../utils/logger.js";
import { poolTypeNames } from "../config/gacha";
import { ticketPool } from "./database/index.js";
import { getAllKeywords } from "./database/queries.js";

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
let keywordsCache: Keyword[] = [];

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
    keywordsCache = await getAllKeywords(ticketPool);
    logger.debug(`Successfully cached ${keywordsCache.length} keywords.`);
  } catch (error) {
    logger.error("Failed to load and cache keywords:", error);
  }
}

export function getGachaPoolsCache(): GachaPool[] {
  return gachaPoolsCache;
}

export function getKeywordsCache(): Keyword[] {
  return keywordsCache;
}
