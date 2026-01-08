import { sql } from "kysely";
import { CacheService } from "../../services/CacheService";
import { gachaDB } from "../../shared/database";
import logger from "../../utils/logger";
import {
  PortfolioItem,
  SpendingBreakdown,
  UserInfoData,
  UserTopCommand,
  UserTopGuild,
} from "../../shared/database/types";

const cacheService = CacheService.getInstance();

async function fetchUserInfoFromDB(userId: string): Promise<UserInfoData> {
  try {
    // Fetch TopSenders and TopReceivers separately to avoid GROUP BY issues
    const [topSendersResult, topReceiversResult] = await Promise.all([
      gachaDB
        .selectFrom("user_transaction_history")
        .select([
          "sender_id",
          sql<number>`COUNT(*)::int`.as("count"),
          sql<number>`SUM(gross_amount)::int`.as("total_amount"),
        ])
        .where("receiver_id", "=", userId)
        .where("sender_id", "!=", userId)
        .groupBy("sender_id")
        .orderBy("count", "desc")
        .limit(10)
        .execute(),
      gachaDB
        .selectFrom("user_transaction_history")
        .select([
          "receiver_id",
          sql<number>`COUNT(*)::int`.as("count"),
          sql<number>`SUM(gross_amount)::int`.as("total_amount"),
        ])
        .where("sender_id", "=", userId)
        .where("receiver_id", "!=", userId)
        .groupBy("receiver_id")
        .orderBy("count", "desc")
        .limit(10)
        .execute(),
    ]);

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
    .selectFrom("TransactionSummary")
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
      recent_transactions: [],
      total_cards: parseInt(result.total_cards as any, 10) || 0,
      total_transactions_count:
        parseInt(result.total_transactions_count as any, 10) || 0,
      total_spent: parseInt(result.total_spent as any, 10) || 0,
      total_received: parseInt(result.total_received as any, 10) || 0,
      spending_breakdown:
        (result.spending_breakdown as SpendingBreakdown[]) || [],
      income_breakdown: (result.income_breakdown as SpendingBreakdown[]) || [],
      portfolio: (result.portfolio as PortfolioItem[]) || [],
      top_senders: topSendersResult.map((row) => ({
        sender_id: row.sender_id.toString(),
        count: row.count,
        total_amount: row.total_amount,
      })),
      top_receivers: topReceiversResult.map((row) => ({
        receiver_id: row.receiver_id.toString(),
        count: row.count,
        total_amount: row.total_amount,
      })),
      oil_balance: parseInt(result.oil_balance as any, 10) || 0,
      oil_ticket_balance: parseInt(result.oil_ticket_balance as any, 10) || 0,
    };
  } catch (error) {
    logger.error(`[fetchUserInfoFromDB] Error fetching user info for user ${userId}:`, {
      error: error instanceof Error ? error.message : String(error),
      userId,
    });
    
    return {
      top_guilds: [],
      top_commands: [],
      recent_transactions: [],
      total_cards: 0,
      total_transactions_count: 0,
      total_spent: 0,
      total_received: 0,
      spending_breakdown: [],
      income_breakdown: [],
      portfolio: [],
      top_senders: [],
      top_receivers: [],
      oil_balance: 0,
      oil_ticket_balance: 0,
    };
  }
}

export async function getUserInfoData(userId: string): Promise<UserInfoData> {
  const cachedData = await cacheService.get<UserInfoData>(
    `user-info:${userId}`
  );
  if (cachedData) {
    return cachedData;
  }

  const dbData = await fetchUserInfoFromDB(userId);
  cacheService.set(`user-info:${userId}`, dbData);

  return dbData;
}
