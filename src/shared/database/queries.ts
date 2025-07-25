import { Pool } from "pg";
import { sql } from "kysely";
import { mimiDLCDb } from ".";
interface PriceHistory {
  price: number;
  timestamp: Date;
}

interface Asset {
  name: string;
  symbol: string;
}

export interface TicketType {
  id: number;
  guild_id: string;
  type_id: string;
  label: string;
  style: string;
  emoji: string | null;
}

export interface OdogStats {
  user_id: string;
  nickname: string;
  total_draws: number;
  top_tier_draws: number;
  rarity_counts: { [rarity: string]: number };
}

function buildTimeCondition(timeRange: string, tableAlias: string): string {
  if (timeRange === "all") {
    return "";
  }

  const match = timeRange.match(/^(\d+)([hdwmy])$/);
  if (match) {
    const value = parseInt(match[1], 10);
    const unit = match[2];
    let interval;
    switch (unit) {
      case "h":
        interval = "hours";
        break;
      case "d":
        interval = "days";
        break;
      case "w":
        interval = "weeks";
        break;
      case "m":
        interval = "months";
        break;
      case "y":
        interval = "years";
        break;
      default:
        return "";
    }
    return `AND ${tableAlias}.timestamp >= NOW() - INTERVAL '${value} ${interval}'`;
  }
  return "";
}

export async function getAssetPriceHistory(
  pool: Pool,
  symbol: string,
  timeRange: string
): Promise<PriceHistory[]> {
  const timeCondition = buildTimeCondition(timeRange, "aph");

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

export async function getAllAssetsWithLatestPrice(
  pool: Pool
): Promise<AssetWithLatestPrice[]> {
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
  return result.rows.map((row: any) => ({
    ...row,
    price: parseFloat(row.price),
  }));
}

export interface AssetSummary {
  high: number;
  low: number;
  avg: number;
  startPrice: number;
  endPrice: number;
}

export async function getAssetSummary(
  pool: Pool,
  symbol: string,
  timeRange: string
): Promise<AssetSummary | null> {
  const timeCondition = buildTimeCondition(timeRange, "aph");

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
  if (!result.rows[0]) {
    return null;
  }

  const summary = result.rows[0];

  return {
    high: parseFloat(summary.high),
    low: parseFloat(summary.low),
    avg: parseFloat(summary.avg),
    startPrice: parseFloat(summary.startprice),
    endPrice: parseFloat(summary.endprice),
  };
}
export async function getPriceHistoryWithVolume(
  pool: Pool,
  symbol: string,
  timeRange: string
): Promise<any[]> {
  const timeCondition = buildTimeCondition(timeRange, "aph");

  const query = `
    WITH PriceHistory AS (
      SELECT
        to_timestamp(floor(extract('epoch' from aph.timestamp) / 1800) * 1800) AS timestamp_bucket,
        (array_agg(aph.price ORDER BY aph.timestamp DESC))[1] as price
      FROM asset_price_history aph
      JOIN virtual_assets va ON aph.asset_id = va.asset_id
      WHERE va.asset_symbol = $1
        ${timeCondition}
      GROUP BY timestamp_bucket
    ),
    VolumeHistory AS (
      SELECT
        to_timestamp(floor(extract('epoch' from mt.timestamp) / 1800) * 1800) AS timestamp_bucket,
        SUM(mt.quantity) as volume
      FROM market_transactions mt
      JOIN virtual_assets va ON mt.asset_id = va.asset_id
      WHERE va.asset_symbol = $1
        ${buildTimeCondition(timeRange, "mt")}
      GROUP BY timestamp_bucket
    )
    SELECT
      ph.timestamp_bucket as timestamp,
      ph.price,
      COALESCE(vh.volume, 0) as volume
    FROM PriceHistory ph
    LEFT JOIN VolumeHistory vh ON ph.timestamp_bucket = vh.timestamp_bucket
    ORDER BY ph.timestamp_bucket ASC;
  `;

  const result = await pool.query(query, [symbol]);
  // Manually parse numeric types
  return result.rows.map((row: any) => ({
    price: parseFloat(row.price),
    volume: parseInt(row.volume, 10),
    timestamp: row.timestamp,
  }));
}

export async function searchAssets(
  pool: Pool,
  searchText: string
): Promise<Asset[]> {
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

export async function getGachaPools(
  pool: Pool,
  searchText: string
): Promise<GachaPool[]> {
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
  pool: Pool,
  gacha_id: string | null,
  days: number | "all"
): Promise<OdogStats[]> {
  const queryParams: any[] = [];
  let whereClauses: string[] = [];
  let paramIndex = 1;

  if (gacha_id) {
    whereClauses.push(`gmc.pool_type = $${paramIndex++}`);
    queryParams.push(gacha_id);
  }

  if (days !== "all") {
    whereClauses.push(`gdh.created_at >= NOW() - INTERVAL '${days} days'`);
  }

  const whereString =
    whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const query = `
    WITH PoolMaxRarity AS (
      SELECT
        pool_type,
        MAX(rarity) as max_rarity
      FROM gacha_master_cards
      GROUP BY pool_type
    ),
    AllTopTierDraws AS (
      SELECT
        gdh.user_id,
        gmc.rarity
      FROM gacha_draw_history gdh
      JOIN gacha_master_cards gmc ON gdh.card_id = gmc.card_id
      JOIN PoolMaxRarity pmr ON gmc.pool_type = pmr.pool_type
      ${whereString} -- The time/pool filter is applied here
      AND gmc.rarity >= pmr.max_rarity - 1
    ),
    UserRarityCounts AS (
      SELECT
        user_id,
        rarity,
        COUNT(*) AS draw_count
      FROM AllTopTierDraws
      GROUP BY user_id, rarity
    ),
    AggregatedStats AS (
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
  pool: Pool,
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
  pool: Pool,
  guildId: string,
  channelId: string
): Promise<void> {
  const query = `
    DELETE FROM auto_reacts
    WHERE guild_id = $1 AND channel_id = $2;
  `;
  await pool.query(query, [guildId, channelId]);
}

export async function getAutoreacts(
  pool: Pool,
  guildId: string
): Promise<AutoReact[]> {
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
  pool: Pool,
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
  pool: Pool,
  guildId: string,
  keyword: string
): Promise<void> {
  const query = `
    DELETE FROM keywords
    WHERE guild_id = $1 AND keyword = $2;
  `;
  await pool.query(query, [guildId, keyword]);
}

export async function getKeywords(
  pool: Pool,
  guildId: string
): Promise<Keyword[]> {
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

export async function addTodo(
  pool: Pool,
  userId: string,
  item: string
): Promise<void> {
  const query = `
    INSERT INTO todos (user_id, item)
    VALUES ($1, $2);
  `;
  await pool.query(query, [userId, item]);
}

export async function removeTodo(
  pool: Pool,
  id: number,
  userId: string
): Promise<number> {
  const query = `
    DELETE FROM todos
    WHERE id = $1 AND user_id = $2;
  `;
  const result = await pool.query(query, [id, userId]);
  return result.rowCount ?? 0;
}

export async function getTodos(pool: Pool, userId: string): Promise<Todo[]> {
  const query = `
    SELECT id, item, created_at
    FROM todos
    WHERE user_id = $1
    ORDER BY created_at ASC;
  `;
  const result = await pool.query(query, [userId]);
  return result.rows;
}

export async function clearTodos(pool: Pool, userId: string): Promise<void> {
  const query = `
    DELETE FROM todos
    WHERE user_id = $1;
  `;
  await pool.query(query, [userId]);
}

export async function getAllKeywords(pool: Pool): Promise<Keyword[]> {
  const query = `SELECT id, guild_id, keyword, reply, match_type FROM keywords;`;
  const result = await pool.query(query);
  return result.rows;
}

export async function getAllAutoreacts(pool: Pool): Promise<AutoReact[]> {
  const query = `SELECT guild_id, channel_id, emoji FROM auto_reacts;`;
  const result = await pool.query(query);
  return result.rows;
}

export async function addTicketType(
  pool: Pool,
  guildId: string,
  typeId: string,
  label: string,
  style: string,
  emoji: string | null
): Promise<void> {
  const query = `
    INSERT INTO ticket_types (guild_id, type_id, label, style, emoji)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (guild_id, type_id) DO UPDATE SET
      label = EXCLUDED.label,
      style = EXCLUDED.style,
      emoji = EXCLUDED.emoji;
  `;
  await pool.query(query, [guildId, typeId, label, style, emoji]);
}

export async function getTicketTypes(
  pool: Pool,
  guildId: string
): Promise<TicketType[]> {
  const { rows } = await pool.query<TicketType>(
    "SELECT * FROM ticket_types WHERE guild_id = $1 ORDER BY id",
    [guildId]
  );
  return rows;
}

export async function getTicketByChannelId(
  pool: Pool,
  channelId: string
): Promise<any> {
  const query = `
    SELECT * FROM tickets WHERE "channelId" = $1
  `;
  const result = await pool.query(query, [channelId]);
  return result;
}

// Price Alert Queries
export interface PriceAlert {
  id: number;
  user_id: string;
  asset_symbol: string;
  condition: "above" | "below";
  target_price: number;
  created_at: Date;
  repeatable: boolean;
  locale: string;
}

export async function createPriceAlert(
  userId: string,
  assetSymbol: string,
  condition: "above" | "below",
  targetPrice: number,
  repeatable: boolean,
  locale: string
): Promise<void> {
  await mimiDLCDb
    .insertInto("price_alerts")
    .values({
      user_id: userId,
      asset_symbol: assetSymbol,
      condition: condition,
      target_price: targetPrice,
      created_at: new Date().toISOString(),
      repeatable: repeatable,
      locale: locale,
    })
    .execute();
}

export async function getUserPriceAlerts(
  userId: string
): Promise<PriceAlert[]> {
  return await mimiDLCDb
    .selectFrom("price_alerts")
    .selectAll()
    .where("user_id", "=", userId)
    .orderBy("created_at", "desc")
    .execute();
}

export async function removePriceAlert(
  alertId: number,
  userId: string
): Promise<bigint> {
  const result = await mimiDLCDb
    .deleteFrom("price_alerts")
    .where("id", "=", alertId)
    .where("user_id", "=", userId)
    .executeTakeFirst();
  return result.numDeletedRows;
}

export async function getAllPriceAlerts(): Promise<PriceAlert[]> {
  return await mimiDLCDb
    .selectFrom("price_alerts")
    .selectAll()
    .where((eb) =>
      eb.or([
        eb("last_notified_at", "is", null),
        eb.and([
          eb("repeatable", "=", true),
          sql<boolean>`last_notified_at < NOW() - INTERVAL '1 hour'`,
        ]),
      ])
    )
    .execute();
}

export async function updatePriceAlertNotified(alertId: number): Promise<void> {
  await mimiDLCDb
    .updateTable("price_alerts")
    .set({ last_notified_at: new Date().toISOString() })
    .where("id", "=", alertId)
    .execute();
}

// AI Conversation Queries
export interface ConversationMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export async function createConversation(
  pool: Pool,
  userId: string
): Promise<number> {
  const query = `
    INSERT INTO ai_conversations (user_id)
    VALUES ($1)
    RETURNING id;
  `;
  const result = await pool.query(query, [userId]);
  return result.rows[0].id;
}

export async function getConversationHistory(
  pool: Pool,
  conversationId: number
): Promise<ConversationMessage[]> {
  const query = `
    SELECT role, content
    FROM ai_conversation_messages
    WHERE conversation_id = $1
    ORDER BY created_at ASC;
  `;
  const result = await pool.query(query, [conversationId]);
  return result.rows;
}

export async function addConversationMessage(
  pool: Pool,
  conversationId: number,
  role: "user" | "assistant",
  content: string
): Promise<void> {
  const query = `
    INSERT INTO ai_conversation_messages (conversation_id, role, content)
    VALUES ($1, $2, $3);
  `;
  await pool.query(query, [conversationId, role, content]);
  // Also update the updated_at timestamp on the parent conversation
  const updateQuery = `
    UPDATE ai_conversations
    SET updated_at = NOW()
    WHERE id = $1;
  `;
  await pool.query(updateQuery, [conversationId]);
}

// User Info Queries
export interface UserTopGuild {
  guild_id: string;
  usage_count: number;
}

export interface UserTopCommand {
  command_name: string;
  usage_count: number;
}

export interface UserTransaction {
  sender_id: string;
  receiver_id: string;
  amount: number;
  created_at: Date;
}

export interface SpendingBreakdown {
  transaction_type: string;
  total_amount: number;
}

export interface PortfolioItem {
  asset_name: string;
  quantity: number;
  total_value: number;
}

export interface TopSender {
  sender_id: string;
  count: number;
  total_amount: number;
}

export interface TopReceiver {
  receiver_id: string;
  count: number;
  total_amount: number;
}

export interface UserInfoData {
  top_guilds: UserTopGuild[];
  top_commands: UserTopCommand[];
  recent_transactions: UserTransaction[];
  total_cards: number;
  total_spent: number;
  total_received: number;
  spending_breakdown: SpendingBreakdown[];
  income_breakdown: SpendingBreakdown[];
  portfolio: PortfolioItem[];
  top_senders: TopSender[];
  top_receivers: TopReceiver[];
  oil_balance: number;
  oil_ticket_balance: number;
  total_transactions_count: number;
}

export async function getRecentTransactions(
  pool: Pool,
  userId: string,
  offset: number,
  limit: number
): Promise<UserTransaction[]> {
  const query = `
    SELECT sender_id, receiver_id, net_amount, created_at
    FROM user_transaction_history
    WHERE sender_id = $1 OR receiver_id = $1
    ORDER BY created_at DESC
    OFFSET $2
    LIMIT $3;
  `;
  const result = await pool.query(query, [userId, offset, limit]);
  return result.rows.map((row) => ({
    ...row,
    amount: row.net_amount,
  }));
}

export async function getUserInfoData(
  pool: Pool,
  userId: string
): Promise<UserInfoData> {
  const query = `
    WITH TransactionSummary AS (
      SELECT
        COALESCE(SUM(CASE WHEN sender_id = $1 THEN gross_amount ELSE 0 END), 0) AS total_spent,
        COALESCE(SUM(CASE WHEN receiver_id = $1 THEN gross_amount ELSE 0 END), 0) AS total_received
      FROM user_transaction_history
      WHERE sender_id = $1 OR receiver_id = $1
    ),
    SpendingBreakdown AS (
      SELECT
        jsonb_agg(jsonb_build_object('transaction_type', transaction_type, 'total_amount', total_amount)) AS data
      FROM (
        SELECT transaction_type, SUM(gross_amount)::int AS total_amount
        FROM user_transaction_history
        WHERE sender_id = $1
        GROUP BY transaction_type
        ORDER BY total_amount DESC
      ) AS sub
    ),
    IncomeBreakdown AS (
        SELECT
            jsonb_agg(jsonb_build_object('transaction_type', transaction_type, 'total_amount', total_amount)) AS data
        FROM (
            SELECT transaction_type, SUM(gross_amount)::int AS total_amount
            FROM user_transaction_history
            WHERE receiver_id = $1
            GROUP BY transaction_type
            ORDER BY total_amount DESC
        ) AS sub
    ),
    Portfolio AS (
      SELECT
        jsonb_agg(jsonb_build_object('asset_name', va.asset_name, 'quantity', pp.quantity, 'total_value', pp.quantity * va.current_price)) AS data
      FROM player_portfolios pp
      JOIN virtual_assets va ON pp.asset_id = va.asset_id
      WHERE pp.user_id = $1
    ),
    TopSenders AS (
      SELECT
        jsonb_agg(jsonb_build_object('sender_id', sender_id::text, 'count', count, 'total_amount', total_amount) ORDER BY count DESC) AS data
      FROM (
        SELECT sender_id, COUNT(*)::int AS count, SUM(gross_amount)::int AS total_amount
        FROM user_transaction_history
        WHERE receiver_id = $1 AND sender_id != $1
        GROUP BY sender_id
        ORDER BY count DESC
        LIMIT 10
      ) AS sub
    ),
    TopReceivers AS (
      SELECT
        jsonb_agg(jsonb_build_object('receiver_id', receiver_id::text, 'count', count, 'total_amount', total_amount) ORDER BY count DESC) AS data
      FROM (
        SELECT receiver_id, COUNT(*)::int AS count, SUM(gross_amount)::int AS total_amount
        FROM user_transaction_history
        WHERE sender_id = $1 AND receiver_id != $1
        GROUP BY receiver_id
        ORDER BY count DESC
        LIMIT 10
      ) AS sub
    ),
    TopGuilds AS (
        SELECT
            jsonb_agg(jsonb_build_object('guild_id', guild_id::text, 'usage_count', usage_count) ORDER BY usage_count DESC) AS data
        FROM (
            SELECT guild_id, COUNT(id)::int AS usage_count
            FROM command_usage_stats WHERE user_id = $1
            GROUP BY guild_id ORDER BY usage_count DESC LIMIT 10
        ) AS sub
    ),
    TopCommands AS (
        SELECT
            jsonb_agg(jsonb_build_object('command_name', command_name, 'usage_count', usage_count) ORDER BY usage_count DESC) AS data
        FROM (
            SELECT command_name, COUNT(id)::int AS usage_count
            FROM command_usage_stats WHERE user_id = $1
            GROUP BY command_name ORDER BY usage_count DESC LIMIT 10
        ) AS sub
    ),
    TotalCards AS (
        SELECT SUM(quantity) AS data
        FROM gacha_user_collections WHERE user_id = $1
    ),
    TotalTransactions AS (
        SELECT COUNT(*)::int AS count
        FROM user_transaction_history
        WHERE sender_id = $1 OR receiver_id = $1
    ),
    UserBalances AS (
        SELECT oil_balance, oil_ticket_balance
        FROM gacha_users WHERE user_id = $1
    )
    SELECT
        (SELECT data FROM TopGuilds) AS top_guilds,
        (SELECT data FROM TopCommands) AS top_commands,
        (SELECT data FROM TotalCards) AS total_cards,
        (SELECT count FROM TotalTransactions) AS total_transactions_count,
        (SELECT total_spent FROM TransactionSummary) AS total_spent,
        (SELECT total_received FROM TransactionSummary) AS total_received,
        (SELECT data FROM SpendingBreakdown) AS spending_breakdown,
        (SELECT data FROM IncomeBreakdown) AS income_breakdown,
        (SELECT data FROM Portfolio) AS portfolio,
        (SELECT data FROM TopSenders) AS top_senders,
        (SELECT data FROM TopReceivers) AS top_receivers,
        (SELECT oil_balance FROM UserBalances) AS oil_balance,
        (SELECT oil_ticket_balance FROM UserBalances) AS oil_ticket_balance;
  `;
  const result = await pool.query(query, [userId]);
  const row = result.rows[0];

  return {
    top_guilds: row.top_guilds || [],
    top_commands: row.top_commands || [],
    recent_transactions: [], // This will be fetched separately
    total_cards: parseInt(row.total_cards, 10) || 0,
    total_transactions_count: parseInt(row.total_transactions_count, 10) || 0,
    total_spent: parseInt(row.total_spent, 10) || 0,
    total_received: parseInt(row.total_received, 10) || 0,
    spending_breakdown: row.spending_breakdown || [],
    income_breakdown: row.income_breakdown || [],
    portfolio: row.portfolio || [],
    top_senders: row.top_senders || [],
    top_receivers: row.top_receivers || [],
    oil_balance: parseInt(row.oil_balance, 10) || 0,
    oil_ticket_balance: parseInt(row.oil_ticket_balance, 10) || 0,
  };
}
