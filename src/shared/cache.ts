import logger from "../utils/logger.js";
import { poolTypeNames } from "../config/gacha";

// Define the type based on the expected structure
export interface GachaPool {
  gacha_id: string;
  gacha_name: string;
  gacha_name_alias: string;
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
    logger.debug(`Successfully cached ${gachaPoolsCache.length} gacha pools.`);
  } catch (error) {
    logger.error("Failed to load and cache gacha pools:", error);
  }
}

export function getGachaPoolsCache(): GachaPool[] {
  return gachaPoolsCache;
}
