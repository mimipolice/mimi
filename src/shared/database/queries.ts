import pool from "./index";

interface PriceHistory {
  price: number;
  timestamp: Date;
}

interface Asset {
  name: string;
  symbol: string;
}

export interface OdogStats {
  user_id: string;
  nickname: string;
  total_draws: number;
  top_tier_draws: number;
  rarity_counts: { [rarity: string]: number };
}

export async function getAssetPriceHistory(
  symbol: string,
  timeRange: string
): Promise<PriceHistory[]> {
  let timeCondition = "";
  if (timeRange !== "all") {
    const unit = timeRange.slice(-1);
    const value = parseInt(timeRange.slice(0, -1));
    const interval = unit === "d" ? "days" : unit === "m" ? "months" : "years";
    timeCondition = `AND aph.timestamp >= NOW() - INTERVAL '${value} ${interval}'`;
  }

  const query = `
    SELECT
      aph.price,
      aph.timestamp
    FROM asset_price_history aph
    JOIN virtual_assets va ON aph.asset_id = va.asset_id
    WHERE va.asset_symbol = $1
      ${timeCondition}
    ORDER BY aph.timestamp ASC;
  `;

  const result = await pool.query(query, [symbol]);
  return result.rows;
}

export interface AssetWithLatestPrice {
  asset_symbol: string;
  asset_name: string;
  price: number;
  timestamp: Date;
}

export async function getAllAssetsWithLatestPrice(): Promise<
  AssetWithLatestPrice[]
> {
  const query = `
    WITH RankedPrices AS (
      SELECT
        va.asset_symbol,
        va.asset_name,
        aph.price,
        aph.timestamp,
        ROW_NUMBER() OVER(PARTITION BY va.asset_symbol ORDER BY aph.timestamp DESC) as rn
      FROM virtual_assets va
      JOIN asset_price_history aph ON va.asset_id = aph.asset_id
    )
    SELECT
      asset_symbol,
      asset_name,
      price,
      timestamp
    FROM RankedPrices
    WHERE rn = 1;
  `;
  const result = await pool.query(query);
  return result.rows;
}

export interface AssetSummary {
  high: number;
  low: number;
  avg: number;
  startPrice: number;
  endPrice: number;
}

export async function getAssetSummary(
  symbol: string,
  timeRange: string
): Promise<AssetSummary | null> {
  let timeCondition = "";
  if (timeRange !== "all") {
    const unit = timeRange.slice(-1);
    const value = parseInt(timeRange.slice(0, -1));
    const interval = unit === "d" ? "days" : unit === "m" ? "months" : "years";
    timeCondition = `AND aph.timestamp >= NOW() - INTERVAL '${value} ${interval}'`;
  }

  const query = `
    WITH PriceData AS (
      SELECT
        aph.price,
        aph.timestamp
      FROM asset_price_history aph
      JOIN virtual_assets va ON aph.asset_id = va.asset_id
      WHERE va.asset_symbol = $1
        ${timeCondition}
    )
    SELECT
      MAX(price) as high,
      MIN(price) as low,
      AVG(price) as avg,
      FIRST_VALUE(price) OVER (ORDER BY timestamp ASC) as startPrice,
      LAST_VALUE(price) OVER (ORDER BY timestamp ASC) as endPrice
    FROM PriceData
    GROUP BY timestamp, price
    ORDER BY timestamp DESC
    LIMIT 1;
  `;

  const result = await pool.query(query, [symbol]);
  return result.rows[0] || null;
}

export async function searchAssets(searchText: string): Promise<Asset[]> {
  const query = `
    SELECT asset_name as name, asset_symbol as symbol
    FROM virtual_assets
    WHERE asset_symbol ILIKE $1 OR asset_name ILIKE $1
    LIMIT 25;
  `;
  const result = await pool.query(query, [`%${searchText}%`]);
  return result.rows;
}

export interface GachaPool {
  gacha_id: string;
  gacha_name: string;
  gacha_name_alias: string;
}

export async function getGachaPools(searchText: string): Promise<GachaPool[]> {
  const query = `
    SELECT DISTINCT
      gacha_id,
      gacha_name,
      gacha_name_alias
    FROM gacha_pools
    WHERE gacha_name ILIKE $1 OR gacha_name_alias ILIKE $1
    ORDER BY gacha_name
    LIMIT 25;
  `;
  const result = await pool.query(query, [`%${searchText}%`]);
  return result.rows;
}

export async function getOdogRankings(
  gacha_id: string | null,
  days: number | "all"
): Promise<OdogStats[]> {
  const queryParams: any[] = [];
  let whereClauses: string[] = [];
  let paramIndex = 1;

  if (gacha_id) {
    whereClauses.push(`gdh.user_selected_pool = $${paramIndex++}`);
    queryParams.push(gacha_id);
  }

  if (days !== "all") {
    whereClauses.push(`gdh.created_at >= NOW() - INTERVAL '${days} days'`);
  }

  const whereString =
    whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const query = `
    WITH PoolMaxRarity AS (
      -- Determine the absolute max rarity for each pool type directly from the master card table.
      -- This is the definitive source of truth for a pool's max rarity.
      SELECT
        pool_type,
        MAX(rarity) as max_rarity
      FROM gacha_master_cards
      GROUP BY pool_type
    ),
    AllTopTierDraws AS (
      -- Select draws within the specified time period that meet the top-tier criteria
      -- based on the definitive max rarity of their pool type.
      SELECT
        gdh.user_id,
        gmc.rarity
      FROM gacha_draw_history gdh
      JOIN gacha_master_cards gmc ON gdh.card_id = gmc.card_id
      JOIN PoolMaxRarity pmr ON gmc.pool_type = pmr.pool_type
      ${whereString} -- The time/pool filter is applied here
      AND gmc.rarity >= pmr.max_rarity - 1 -- Filter for top-tier cards
    ),
    UserRarityCounts AS (
      -- Count the top-tier draws for each user and rarity
      SELECT
        user_id,
        rarity,
        COUNT(*) AS draw_count
      FROM AllTopTierDraws
      GROUP BY user_id, rarity
    ),
    AggregatedStats AS (
      -- Aggregate stats for each user, creating specific columns for sorting
      SELECT
        urc.user_id,
        SUM(urc.draw_count) AS total_draws,
        jsonb_object_agg(urc.rarity, urc.draw_count) AS rarity_counts,
        COALESCE(SUM(CASE WHEN urc.rarity = 7 THEN urc.draw_count END), 0) as r7,
        COALESCE(SUM(CASE WHEN urc.rarity = 6 THEN urc.draw_count END), 0) as r6,
        COALESCE(SUM(CASE WHEN urc.rarity = 5 THEN urc.draw_count END), 0) as r5,
        COALESCE(SUM(CASE WHEN urc.rarity = 4 THEN urc.draw_count END), 0) as r4,
        COALESCE(SUM(CASE WHEN urc.rarity = 3 THEN urc.draw_count END), 0) as r3,
        COALESCE(SUM(CASE WHEN urc.rarity = 2 THEN urc.draw_count END), 0) as r2,
        COALESCE(SUM(CASE WHEN urc.rarity = 1 THEN urc.draw_count END), 0) as r1
      FROM UserRarityCounts urc
      GROUP BY urc.user_id
    )
    -- Final selection and ordering
    SELECT
      gu.user_id,
      gu.nickname,
      ags.total_draws,
      ags.total_draws AS top_tier_draws,
      ags.rarity_counts
    FROM gacha_users gu
    JOIN AggregatedStats ags ON gu.user_id = ags.user_id
    ORDER BY
      ags.r7 DESC,
      ags.r6 DESC,
      ags.r5 DESC,
      ags.r4 DESC,
      ags.r3 DESC,
      ags.r2 DESC,
      ags.r1 DESC,
      ags.total_draws DESC;
  `;

  const result = await pool.query(query, queryParams);
  return result.rows;
}

// Auto-React Queries
export interface AutoReact {
  guild_id: string;
  channel_id: string;
  emoji: string;
}

export async function setAutoreact(
  guildId: string,
  channelId: string,
  emoji: string
): Promise<void> {
  const query = `
    INSERT INTO auto_reacts (guild_id, channel_id, emoji)
    VALUES ($1, $2, $3)
    ON CONFLICT (guild_id, channel_id)
    DO UPDATE SET emoji = $3;
  `;
  await pool.query(query, [guildId, channelId, emoji]);
}

export async function removeAutoreact(
  guildId: string,
  channelId: string
): Promise<void> {
  const query = `
    DELETE FROM auto_reacts
    WHERE guild_id = $1 AND channel_id = $2;
  `;
  await pool.query(query, [guildId, channelId]);
}

export async function getAutoreacts(guildId: string): Promise<AutoReact[]> {
  const query = `
    SELECT channel_id, emoji
    FROM auto_reacts
    WHERE guild_id = $1;
  `;
  const result = await pool.query(query, [guildId]);
  return result.rows;
}

// Keyword Queries
export interface Keyword {
  id: number;
  guild_id: string;
  keyword: string;
  reply: string;
  match_type: "exact" | "contains";
}

export async function addKeyword(
  guildId: string,
  keyword: string,
  reply: string,
  matchType: "exact" | "contains"
): Promise<void> {
  const query = `
    INSERT INTO keywords (guild_id, keyword, reply, match_type)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (guild_id, keyword)
    DO UPDATE SET reply = $3, match_type = $4;
  `;
  await pool.query(query, [guildId, keyword, reply, matchType]);
}

export async function removeKeyword(
  guildId: string,
  keyword: string
): Promise<void> {
  const query = `
    DELETE FROM keywords
    WHERE guild_id = $1 AND keyword = $2;
  `;
  await pool.query(query, [guildId, keyword]);
}

export async function getKeywords(guildId: string): Promise<Keyword[]> {
  const query = `
    SELECT id, keyword, reply, match_type
    FROM keywords
    WHERE guild_id = $1;
  `;
  const result = await pool.query(query, [guildId]);
  return result.rows;
}

// To-Do List Queries
export interface Todo {
  id: number;
  user_id: string;
  item: string;
  created_at: Date;
}

export async function addTodo(userId: string, item: string): Promise<void> {
  const query = `
    INSERT INTO todos (user_id, item)
    VALUES ($1, $2);
  `;
  await pool.query(query, [userId, item]);
}

export async function removeTodo(id: number, userId: string): Promise<number> {
  const query = `
    DELETE FROM todos
    WHERE id = $1 AND user_id = $2;
  `;
  const result = await pool.query(query, [id, userId]);
  return result.rowCount ?? 0;
}

export async function getTodos(userId: string): Promise<Todo[]> {
  const query = `
    SELECT id, item, created_at
    FROM todos
    WHERE user_id = $1
    ORDER BY created_at ASC;
  `;
  const result = await pool.query(query, [userId]);
  return result.rows;
}

export async function clearTodos(userId: string): Promise<void> {
  const query = `
    DELETE FROM todos
    WHERE user_id = $1;
  `;
  await pool.query(query, [userId]);
}

export async function getAllKeywords(): Promise<Keyword[]> {
  const query = `SELECT id, guild_id, keyword, reply, match_type FROM keywords;`;
  const result = await pool.query(query);
  return result.rows;
}

export async function getAllAutoreacts(): Promise<AutoReact[]> {
  const query = `SELECT guild_id, channel_id, emoji FROM auto_reacts;`;
  const result = await pool.query(query);
  return result.rows;
}
