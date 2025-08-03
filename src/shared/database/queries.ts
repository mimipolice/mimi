import { Kysely, sql } from "kysely";
import { gachaDB, mimiDLCDb } from ".";
import { MimiDLCDB } from "./types";

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

export async function getAssetPriceHistory(
  symbol: string,
  timeRange: string
): Promise<PriceHistory[]> {
  let query = gachaDB
    .selectFrom("asset_price_history")
    .innerJoin(
      "virtual_assets",
      "asset_price_history.asset_id",
      "virtual_assets.asset_id"
    )
    .select(["asset_price_history.price", "asset_price_history.timestamp"])
    .where("virtual_assets.asset_symbol", "=", symbol)
    .orderBy("asset_price_history.timestamp", "asc");

  if (timeRange !== "all") {
    const match = timeRange.match(/^(\d+)([hdwmy])$/);
    if (match) {
      const value = parseInt(match[1], 10);
      const unitMap = {
        h: "hours",
        d: "days",
        w: "weeks",
        m: "months",
        y: "years",
      };
      const unit = unitMap[match[2] as keyof typeof unitMap];
      if (unit) {
        query = query.where(
          "asset_price_history.timestamp",
          ">=",
          sql`NOW() - INTERVAL '${sql.raw(`${value} ${unit}`)}'` as any
        );
      }
    }
  }

  const result = await query.execute();
  return result.map((row) => ({
    ...row,
    price: Number(row.price),
  }));
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
  const result = await gachaDB
    .with("RankedPrices", (db) =>
      db
        .selectFrom("virtual_assets")
        .innerJoin(
          "asset_price_history",
          "virtual_assets.asset_id",
          "asset_price_history.asset_id"
        )
        .select([
          "virtual_assets.asset_symbol",
          "virtual_assets.asset_name",
          "asset_price_history.price",
          "asset_price_history.timestamp",
          sql<number>`ROW_NUMBER() OVER(PARTITION BY virtual_assets.asset_symbol ORDER BY asset_price_history.timestamp DESC)`.as(
            "rn"
          ),
        ])
    )
    .selectFrom("RankedPrices")
    .select(["asset_symbol", "asset_name", "price", "timestamp"])
    .where("rn", "=", 1)
    .execute();

  return result.map((row) => ({
    ...row,
    price: parseFloat(row.price as unknown as string),
    timestamp: row.timestamp as Date,
    asset_symbol: row.asset_symbol as string,
    asset_name: row.asset_name as string,
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
  symbol: string,
  timeRange: string
): Promise<AssetSummary | null> {
  let query = gachaDB
    .selectFrom("asset_price_history")
    .innerJoin(
      "virtual_assets",
      "asset_price_history.asset_id",
      "virtual_assets.asset_id"
    )
    .where("virtual_assets.asset_symbol", "=", symbol);

  if (timeRange !== "all") {
    const match = timeRange.match(/^(\d+)([hdwmy])$/);
    if (match) {
      const value = parseInt(match[1], 10);
      const unitMap = {
        h: "hours",
        d: "days",
        w: "weeks",
        m: "months",
        y: "years",
      };
      const unit = unitMap[match[2] as keyof typeof unitMap];
      if (unit) {
        query = query.where(
          "asset_price_history.timestamp",
          ">=",
          sql`NOW() - INTERVAL '${sql.raw(`${value} ${unit}`)}'` as any
        );
      }
    }
  }

  const result = await query
    .select((eb) => [
      eb.fn.max("price").as("high"),
      eb.fn.min("price").as("low"),
      eb.fn.avg("price").as("avg"),
      sql<number>`FIRST_VALUE(price) OVER (ORDER BY timestamp ASC)`.as(
        "startPrice"
      ),
      sql<number>`LAST_VALUE(price) OVER (ORDER BY timestamp ASC)`.as(
        "endPrice"
      ),
    ])
    .orderBy("timestamp", "desc")
    .limit(1)
    .executeTakeFirst();

  if (!result) {
    return null;
  }

  return {
    high: parseFloat(result.high as any),
    low: parseFloat(result.low as any),
    avg: parseFloat(result.avg as any),
    startPrice: parseFloat(result.startPrice as any),
    endPrice: parseFloat(result.endPrice as any),
  };
}
export async function getPriceHistoryWithVolume(
  symbol: string,
  timeRange: string
): Promise<any[]> {
  let priceHistorySubQuery = gachaDB
    .selectFrom("asset_price_history")
    .innerJoin(
      "virtual_assets",
      "asset_price_history.asset_id",
      "virtual_assets.asset_id"
    )
    .where("virtual_assets.asset_symbol", "=", symbol);

  if (timeRange !== "all") {
    const match = timeRange.match(/^(\d+)([hdwmy])$/);
    if (match) {
      const value = parseInt(match[1], 10);
      const unitMap = {
        h: "hours",
        d: "days",
        w: "weeks",
        m: "months",
        y: "years",
      };
      const unit = unitMap[match[2] as keyof typeof unitMap];
      if (unit) {
        const interval = sql.raw(`${value} ${unit}`);
        priceHistorySubQuery = priceHistorySubQuery.where(
          "asset_price_history.timestamp",
          ">=",
          sql`NOW() - INTERVAL '${interval}'` as any
        );
      }
    }
  }

  const priceHistoryQuery = priceHistorySubQuery
    .select([
      sql`to_timestamp(floor(extract('epoch' from asset_price_history.timestamp) / 1800) * 1800)`.as(
        "timestamp_bucket"
      ),
      sql`(array_agg(asset_price_history.price ORDER BY asset_price_history.timestamp DESC))[1]`.as(
        "price"
      ),
    ])
    .groupBy("timestamp_bucket");

  let volumeHistorySubQuery = gachaDB
    .selectFrom("market_transactions")
    .innerJoin(
      "virtual_assets",
      "market_transactions.asset_id",
      "virtual_assets.asset_id"
    )
    .where("virtual_assets.asset_symbol", "=", symbol);

  if (timeRange !== "all") {
    const match = timeRange.match(/^(\d+)([hdwmy])$/);
    if (match) {
      const value = parseInt(match[1], 10);
      const unitMap = {
        h: "hours",
        d: "days",
        w: "weeks",
        m: "months",
        y: "years",
      };
      const unit = unitMap[match[2] as keyof typeof unitMap];
      if (unit) {
        const interval = sql.raw(`${value} ${unit}`);
        volumeHistorySubQuery = volumeHistorySubQuery.where(
          "market_transactions.timestamp",
          ">=",
          sql`NOW() - INTERVAL '${interval}'` as any
        );
      }
    }
  }

  const volumeHistoryQuery = volumeHistorySubQuery
    .select([
      sql`to_timestamp(floor(extract('epoch' from market_transactions.timestamp) / 1800) * 1800)`.as(
        "timestamp_bucket"
      ),
      sql`SUM(market_transactions.quantity)`.as("volume"),
    ])
    .groupBy("timestamp_bucket");

  const result = await gachaDB
    .with("PriceHistory", () => priceHistoryQuery)
    .with("VolumeHistory", () => volumeHistoryQuery)
    .selectFrom("PriceHistory")
    .leftJoin(
      "VolumeHistory",
      "PriceHistory.timestamp_bucket",
      "VolumeHistory.timestamp_bucket"
    )
    .select([
      "PriceHistory.timestamp_bucket as timestamp",
      "PriceHistory.price",
      sql`COALESCE("VolumeHistory".volume, 0)`.as("volume"),
    ])
    .orderBy("PriceHistory.timestamp_bucket", "asc")
    .execute();

  return result.map((row) => ({
    price: parseFloat(row.price as string),
    volume: parseInt(row.volume as string, 10),
    timestamp: row.timestamp,
  }));
}

export async function searchAssets(searchText: string): Promise<Asset[]> {
  return await gachaDB
    .selectFrom("virtual_assets")
    .select(["asset_name as name", "asset_symbol as symbol"])
    .where((eb) =>
      eb.or([
        eb("asset_symbol", "ilike", `%${searchText}%`),
        eb("asset_name", "ilike", `%${searchText}%`),
      ])
    )
    .limit(25)
    .execute();
}

export interface GachaPool {
  gacha_id: string;
  gacha_name: string;
  gacha_name_alias: string;
}

export async function getGachaPools(searchText: string): Promise<GachaPool[]> {
  return await gachaDB
    .selectFrom("gacha_pools")
    .distinct()
    .select(["gacha_id", "gacha_name", "gacha_name_alias"])
    .where((eb) =>
      eb.or([
        eb("gacha_name", "ilike", `%${searchText}%`),
        eb("gacha_name_alias", "ilike", `%${searchText}%`),
      ])
    )
    .orderBy("gacha_name")
    .limit(25)
    .execute();
}

export async function getOdogRankings(
  gacha_id: string | null,
  days: number | "all"
): Promise<OdogStats[]> {
  let query = gachaDB
    .with("PoolMaxRarity", (db) =>
      db
        .selectFrom("gacha_master_cards")
        .select(["pool_type", sql`MAX(rarity)`.as("max_rarity")])
        .groupBy("pool_type")
    )
    .with("AllTopTierDraws", (db) => {
      let subQuery = db
        .selectFrom("gacha_draw_history")
        .innerJoin(
          "gacha_master_cards",
          "gacha_draw_history.card_id",
          "gacha_master_cards.card_id"
        )
        .innerJoin(
          "PoolMaxRarity",
          "gacha_master_cards.pool_type",
          "PoolMaxRarity.pool_type"
        )
        .whereRef(
          "gacha_master_cards.rarity",
          ">=",
          sql`"PoolMaxRarity".max_rarity - 1`
        )
        .select(["gacha_draw_history.user_id", "gacha_master_cards.rarity"]);

      if (gacha_id) {
        subQuery = subQuery.where(
          "gacha_master_cards.pool_type",
          "=",
          gacha_id
        );
      }
      if (days !== "all") {
        subQuery = subQuery.where(
          "gacha_draw_history.created_at",
          ">=",
          sql`NOW() - INTERVAL '${sql.raw(`${days} days`)}'` as any
        );
      }
      return subQuery;
    })
    .with("UserRarityCounts", (db) =>
      db
        .selectFrom("AllTopTierDraws")
        .select(["user_id", "rarity", sql`COUNT(*)`.as("draw_count")])
        .groupBy(["user_id", "rarity"])
    )
    .with("AggregatedStats", (db) =>
      db
        .selectFrom("UserRarityCounts")
        .groupBy("user_id")
        .select([
          "user_id",
          sql`SUM(draw_count)`.as("total_draws"),
          sql`jsonb_object_agg(rarity, draw_count)`.as("rarity_counts"),
          sql`COALESCE(SUM(CASE WHEN rarity = 7 THEN draw_count END), 0)`.as(
            "r7"
          ),
          sql`COALESCE(SUM(CASE WHEN rarity = 6 THEN draw_count END), 0)`.as(
            "r6"
          ),
          sql`COALESCE(SUM(CASE WHEN rarity = 5 THEN draw_count END), 0)`.as(
            "r5"
          ),
          sql`COALESCE(SUM(CASE WHEN rarity = 4 THEN draw_count END), 0)`.as(
            "r4"
          ),
          sql`COALESCE(SUM(CASE WHEN rarity = 3 THEN draw_count END), 0)`.as(
            "r3"
          ),
          sql`COALESCE(SUM(CASE WHEN rarity = 2 THEN draw_count END), 0)`.as(
            "r2"
          ),
          sql`COALESCE(SUM(CASE WHEN rarity = 1 THEN draw_count END), 0)`.as(
            "r1"
          ),
        ])
    )
    .selectFrom("gacha_users")
    .innerJoin(
      "AggregatedStats",
      "gacha_users.user_id",
      "AggregatedStats.user_id"
    )
    .select([
      "gacha_users.user_id",
      "gacha_users.nickname",
      "AggregatedStats.total_draws",
      "AggregatedStats.total_draws as top_tier_draws",
      "AggregatedStats.rarity_counts",
    ])
    .orderBy("r7", "desc")
    .orderBy("r6", "desc")
    .orderBy("r5", "desc")
    .orderBy("r4", "desc")
    .orderBy("r3", "desc")
    .orderBy("r2", "desc")
    .orderBy("r1", "desc")
    .orderBy("total_draws", "desc");

  const result = await query.execute();
  return result.map((row: any) => ({
    ...row,
    rarity_counts: row.rarity_counts || {},
  }));
}

// Auto-React Queries
export interface AutoReact {
  guild_id: string;
  channel_id: string;
  emoji: string;
}

export async function setAutoreact(
  db: Kysely<MimiDLCDB>,
  guildId: string,
  channelId: string,
  emoji: string
): Promise<void> {
  await db
    .insertInto("auto_reacts")
    .values({ guild_id: guildId, channel_id: channelId, emoji: emoji })
    .onConflict((oc) =>
      oc.columns(["guild_id", "channel_id"]).doUpdateSet({ emoji: emoji })
    )
    .execute();
}

export async function removeAutoreact(
  db: Kysely<MimiDLCDB>,
  guildId: string,
  channelId: string
): Promise<void> {
  await db
    .deleteFrom("auto_reacts")
    .where("guild_id", "=", guildId)
    .where("channel_id", "=", channelId)
    .execute();
}

export async function getAutoreacts(
  db: Kysely<MimiDLCDB>,
  guildId: string
): Promise<
  {
    channel_id: string;
    emoji: string;
  }[]
> {
  return await db
    .selectFrom("auto_reacts")
    .select(["channel_id", "emoji"])
    .where("guild_id", "=", guildId)
    .execute();
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
  db: Kysely<MimiDLCDB>,
  guildId: string,
  keyword: string,
  reply: string,
  matchType: "exact" | "contains"
): Promise<void> {
  await db
    .insertInto("keywords")
    .values({
      guild_id: guildId,
      keyword: keyword,
      reply: reply,
      match_type: matchType,
    })
    .onConflict((oc) =>
      oc
        .columns(["guild_id", "keyword"])
        .doUpdateSet({ reply: reply, match_type: matchType })
    )
    .execute();
}

export async function removeKeyword(
  db: Kysely<MimiDLCDB>,
  guildId: string,
  keyword: string
): Promise<void> {
  await db
    .deleteFrom("keywords")
    .where("guild_id", "=", guildId)
    .where("keyword", "=", keyword)
    .execute();
}

export async function getKeywordsByGuild(
  db: Kysely<MimiDLCDB>,
  guildId: string
): Promise<Keyword[]> {
  if (guildId === "*") {
    return await db.selectFrom("keywords").selectAll().execute();
  }
  return await db
    .selectFrom("keywords")
    .selectAll()
    .where("guild_id", "=", guildId)
    .execute();
}

// To-Do List Queries
export interface Todo {
  id: number;
  user_id: string;
  item: string;
  created_at: Date;
}

export async function addTodo(
  db: Kysely<MimiDLCDB>,
  userId: string,
  item: string
): Promise<void> {
  await db
    .insertInto("todos")
    .values({ user_id: userId, item: item })
    .execute();
}

export async function removeTodo(
  db: Kysely<MimiDLCDB>,
  id: number,
  userId: string
): Promise<bigint> {
  const result = await db
    .deleteFrom("todos")
    .where("id", "=", id)
    .where("user_id", "=", userId)
    .executeTakeFirst();
  return result.numDeletedRows;
}

export async function getTodos(
  db: Kysely<MimiDLCDB>,
  userId: string
): Promise<
  {
    id: number;
    item: string;
    created_at: Date;
  }[]
> {
  return await db
    .selectFrom("todos")
    .select(["id", "item", "created_at"])
    .where("user_id", "=", userId)
    .orderBy("created_at", "asc")
    .execute();
}

export async function clearTodos(
  db: Kysely<MimiDLCDB>,
  userId: string
): Promise<void> {
  await db.deleteFrom("todos").where("user_id", "=", userId).execute();
}

export async function getAllAutoreacts(): Promise<AutoReact[]> {
  return await mimiDLCDb
    .selectFrom("auto_reacts")
    .select(["guild_id", "channel_id", "emoji"])
    .execute();
}

export async function addTicketType(
  guildId: string,
  typeId: string,
  label: string,
  style: string,
  emoji: string | null
): Promise<void> {
  await mimiDLCDb
    .insertInto("ticket_types")
    .values({
      guild_id: guildId,
      type_id: typeId,
      label: label,
      style: style,
      emoji: emoji,
    })
    .onConflict((oc) =>
      oc
        .columns(["guild_id", "type_id"])
        .doUpdateSet({ label: label, style: style, emoji: emoji })
    )
    .execute();
}

export async function getTicketTypes(guildId: string): Promise<TicketType[]> {
  return await mimiDLCDb
    .selectFrom("ticket_types")
    .selectAll()
    .where("guild_id", "=", guildId)
    .orderBy("id")
    .execute();
}

export async function getTicketByChannelId(channelId: string): Promise<any> {
  return await mimiDLCDb
    .selectFrom("tickets")
    .selectAll()
    .where("channelId", "=", channelId)
    .executeTakeFirst();
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

export async function findNextAvailablePriceAlertId(
  userId: string
): Promise<number> {
  const result = await mimiDLCDb
    .selectFrom("price_alerts")
    .select("id")
    .where("user_id", "=", userId)
    .orderBy("id", "asc")
    .execute();

  const ids = result.map((row) => row.id);

  if (ids.length === 0) {
    return 1;
  }

  let expectedId = 1;
  for (const id of ids) {
    if (id !== expectedId) {
      return expectedId;
    }
    expectedId++;
  }

  return ids[ids.length - 1] + 1;
}

export async function createPriceAlert(
  id: number,
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
      id: id,
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

// Anti-Spam Log Channel Queries
export async function getAntiSpamLogChannel(
  guildId: string
): Promise<string | null> {
  const result = await mimiDLCDb
    .selectFrom("anti_spam_logs")
    .select("log_channel_id")
    .where("guild_id", "=", guildId)
    .executeTakeFirst();
  return result?.log_channel_id ?? null;
}

export async function setAntiSpamLogChannel(
  guildId: string,
  channelId: string
): Promise<void> {
  await mimiDLCDb
    .insertInto("anti_spam_logs")
    .values({
      guild_id: guildId,
      log_channel_id: channelId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .onConflict((oc) =>
      oc.column("guild_id").doUpdateSet({
        log_channel_id: channelId,
        updated_at: new Date().toISOString(),
      })
    )
    .execute();
}

// Anti-Spam Settings Queries
export interface AntiSpamSettings {
  guildid: string;
  messagethreshold: number;
  time_window: number;
  timeoutduration: number;
}

export async function getAntiSpamSettings(
  guildId: string
): Promise<AntiSpamSettings | null> {
  const result = await mimiDLCDb
    .selectFrom("anti_spam_settings")
    .selectAll()
    .where("guildid", "=", guildId)
    .executeTakeFirst();
  return result ?? null;
}

export async function upsertAntiSpamSettings(
  settings: AntiSpamSettings
): Promise<void> {
  await mimiDLCDb
    .insertInto("anti_spam_settings")
    .values(settings)
    .onConflict((oc) =>
      oc.column("guildid").doUpdateSet({
        messagethreshold: settings.messagethreshold,
        time_window: settings.time_window,
        timeoutduration: settings.timeoutduration,
      })
    )
    .execute();
}

export async function deleteAntiSpamSettings(guildId: string): Promise<void> {
  await mimiDLCDb
    .deleteFrom("anti_spam_settings")
    .where("guildid", "=", guildId)
    .execute();
}

// AI Conversation Queries
export interface ConversationMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export async function createConversation(userId: string): Promise<number> {
  const now = new Date().toISOString();
  const result = await gachaDB
    .insertInto("ai_conversations")
    .values({
      user_id: userId,
      guild_id: "default",
      created_at: now,
      updated_at: now,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  return result.id;
}

export async function getConversationHistory(
  conversationId: number
): Promise<ConversationMessage[]> {
  return await gachaDB
    .selectFrom("ai_conversation_messages")
    .select(["role", "content"])
    .where("conversation_id", "=", conversationId)
    .orderBy("created_at", "asc")
    .execute();
}

export async function addConversationMessage(
  conversationId: number,
  role: "user" | "assistant",
  content: string
): Promise<void> {
  await gachaDB
    .insertInto("ai_conversation_messages")
    .values({
      conversation_id: conversationId,
      role: role,
      content: content,
      created_at: new Date().toISOString(),
    })
    .execute();

  await gachaDB
    .updateTable("ai_conversations")
    .set({ updated_at: new Date().toISOString() })
    .where("id", "=", conversationId)
    .execute();
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
  userId: string,
  offset: number,
  limit: number
): Promise<UserTransaction[]> {
  const result = await gachaDB
    .selectFrom("user_transaction_history")
    .select(["sender_id", "receiver_id", "net_amount", "created_at"])
    .where((eb) =>
      eb.or([eb("sender_id", "=", userId), eb("receiver_id", "=", userId)])
    )
    .orderBy("created_at", "desc")
    .offset(offset)
    .limit(limit)
    .execute();

  return result.map((row) => ({
    ...row,
    amount: row.net_amount,
  }));
}

export async function getUserInfoData(userId: string): Promise<UserInfoData> {
  const result = await gachaDB
    .with("TransactionSummary", (db) =>
      db
        .selectFrom("user_transaction_history")
        .select([
          sql<number>`COALESCE(SUM(CASE WHEN sender_id = ${userId} THEN gross_amount ELSE 0 END), 0)`.as(
            "total_spent"
          ),
          sql<number>`COALESCE(SUM(CASE WHEN receiver_id = ${userId} THEN gross_amount ELSE 0 END), 0)`.as(
            "total_received"
          ),
        ])
        .where((eb) =>
          eb.or([eb("sender_id", "=", userId), eb("receiver_id", "=", userId)])
        )
    )
    .with("SpendingBreakdown", (db) =>
      db
        .selectFrom(
          db
            .selectFrom("balance_history")
            .select([
              "transaction_type",
              sql`SUM(ABS(change_amount))::int`.as("total_amount"),
            ])
            .where("user_id", "=", userId)
            .where("change_amount", "<", 0)
            .where("transaction_type", "is not", null)
            .groupBy("transaction_type")
            .as("sub")
        )
        .select(
          sql`jsonb_agg(jsonb_build_object('transaction_type', transaction_type, 'total_amount', total_amount) ORDER BY total_amount DESC)`.as(
            "data"
          )
        )
    )
    .with("IncomeBreakdown", (db) =>
      db
        .selectFrom(
          db
            .selectFrom("balance_history")
            .select([
              "transaction_type",
              sql`SUM(change_amount)::int`.as("total_amount"),
            ])
            .where("user_id", "=", userId)
            .where("change_amount", ">", 0)
            .where("transaction_type", "is not", null)
            .groupBy("transaction_type")
            .as("sub")
        )
        .select(
          sql`jsonb_agg(jsonb_build_object('transaction_type', transaction_type, 'total_amount', total_amount) ORDER BY total_amount DESC)`.as(
            "data"
          )
        )
    )
    .with("Portfolio", (db) =>
      db
        .selectFrom("player_portfolios")
        .innerJoin(
          "virtual_assets",
          "player_portfolios.asset_id",
          "virtual_assets.asset_id"
        )
        .where("player_portfolios.user_id", "=", userId)
        .select(
          sql`jsonb_agg(jsonb_build_object('asset_name', virtual_assets.asset_name, 'quantity', player_portfolios.quantity, 'total_value', player_portfolios.quantity * virtual_assets.current_price))`.as(
            "data"
          )
        )
    )
    .with("TopSenders", (db) =>
      db
        .selectFrom(
          db
            .selectFrom("user_transaction_history")
            .select([
              "sender_id",
              sql`COUNT(*)::int`.as("count"),
              sql`SUM(gross_amount)::int`.as("total_amount"),
            ])
            .where("receiver_id", "=", userId)
            .where("sender_id", "!=", userId)
            .groupBy("sender_id")
            .orderBy("count", "desc")
            .limit(10)
            .as("sub")
        )
        .select(
          sql`jsonb_agg(jsonb_build_object('sender_id', sender_id::text, 'count', count, 'total_amount', total_amount) ORDER BY count DESC)`.as(
            "data"
          )
        )
    )
    .with("TopReceivers", (db) =>
      db
        .selectFrom(
          db
            .selectFrom("user_transaction_history")
            .select([
              "receiver_id",
              sql`COUNT(*)::int`.as("count"),
              sql`SUM(gross_amount)::int`.as("total_amount"),
            ])
            .where("sender_id", "=", userId)
            .where("receiver_id", "!=", userId)
            .groupBy("receiver_id")
            .orderBy("count", "desc")
            .limit(10)
            .as("sub")
        )
        .select(
          sql`jsonb_agg(jsonb_build_object('receiver_id', receiver_id::text, 'count', count, 'total_amount', total_amount) ORDER BY count DESC)`.as(
            "data"
          )
        )
    )
    .with("TopGuilds", (db) =>
      db
        .selectFrom(
          db
            .selectFrom("command_usage_stats")
            .select(["guild_id", sql`COUNT(id)::int`.as("usage_count")])
            .where("user_id", "=", userId)
            .groupBy("guild_id")
            .orderBy("usage_count", "desc")
            .limit(10)
            .as("sub")
        )
        .select(
          sql`jsonb_agg(jsonb_build_object('guild_id', guild_id::text, 'usage_count', usage_count) ORDER BY usage_count DESC)`.as(
            "data"
          )
        )
    )
    .with("TopCommands", (db) =>
      db
        .selectFrom(
          db
            .selectFrom("command_usage_stats")
            .select(["command_name", sql`COUNT(id)::int`.as("usage_count")])
            .where("user_id", "=", userId)
            .groupBy("command_name")
            .orderBy("usage_count", "desc")
            .limit(10)
            .as("sub")
        )
        .select(
          sql`jsonb_agg(jsonb_build_object('command_name', command_name, 'usage_count', usage_count) ORDER BY usage_count DESC)`.as(
            "data"
          )
        )
    )
    .with("TotalCards", (db) =>
      db
        .selectFrom("gacha_user_collections")
        .select(sql`SUM(quantity)`.as("data"))
        .where("user_id", "=", userId)
    )
    .with("TotalTransactions", (db) =>
      db
        .selectFrom("user_transaction_history")
        .select(sql`COUNT(*)::int`.as("count"))
        .where((eb) =>
          eb.or([eb("sender_id", "=", userId), eb("receiver_id", "=", userId)])
        )
    )
    .with("UserBalances", (db) =>
      db
        .selectFrom("gacha_users")
        .select(["oil_balance", "oil_ticket_balance"])
        .where("user_id", "=", userId)
    )
    .selectFrom("TransactionSummary") // Base table for the final select
    .select([
      (eb) => eb.selectFrom("TopGuilds").select("data").as("top_guilds"),
      (eb) => eb.selectFrom("TopCommands").select("data").as("top_commands"),
      (eb) => eb.selectFrom("TotalCards").select("data").as("total_cards"),
      (eb) =>
        eb
          .selectFrom("TotalTransactions")
          .select("count")
          .as("total_transactions_count"),
      "total_spent",
      "total_received",
      (eb) =>
        eb
          .selectFrom("SpendingBreakdown")
          .select("data")
          .as("spending_breakdown"),
      (eb) =>
        eb.selectFrom("IncomeBreakdown").select("data").as("income_breakdown"),
      (eb) => eb.selectFrom("Portfolio").select("data").as("portfolio"),
      (eb) => eb.selectFrom("TopSenders").select("data").as("top_senders"),
      (eb) => eb.selectFrom("TopReceivers").select("data").as("top_receivers"),
      (eb) =>
        eb.selectFrom("UserBalances").select("oil_balance").as("oil_balance"),
      (eb) =>
        eb
          .selectFrom("UserBalances")
          .select("oil_ticket_balance")
          .as("oil_ticket_balance"),
    ])
    .executeTakeFirstOrThrow();

  return {
    top_guilds: (result.top_guilds as UserTopGuild[]) || [],
    top_commands: (result.top_commands as UserTopCommand[]) || [],
    recent_transactions: [], // This will be fetched separately
    total_cards: parseInt(result.total_cards as any, 10) || 0,
    total_transactions_count:
      parseInt(result.total_transactions_count as any, 10) || 0,
    total_spent: parseInt(result.total_spent as any, 10) || 0,
    total_received: parseInt(result.total_received as any, 10) || 0,
    spending_breakdown:
      (result.spending_breakdown as SpendingBreakdown[]) || [],
    income_breakdown: (result.income_breakdown as SpendingBreakdown[]) || [],
    portfolio: (result.portfolio as PortfolioItem[]) || [],
    top_senders: (result.top_senders as TopSender[]) || [],
    top_receivers: (result.top_receivers as TopReceiver[]) || [],
    oil_balance: parseInt(result.oil_balance as any, 10) || 0,
    oil_ticket_balance: parseInt(result.oil_ticket_balance as any, 10) || 0,
  };
}
