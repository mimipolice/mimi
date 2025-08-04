import { sql } from "kysely";
import { CacheService } from "../services/CacheService";
import { gachaDB } from "../shared/database";
import {
  PortfolioItem,
  SpendingBreakdown,
  TopReceiver,
  TopSender,
  UserInfoData,
  UserTopCommand,
  UserTopGuild,
  UserTransaction,
} from "../shared/database/types";

const cacheService = new CacheService();

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

async function fetchUserInfoFromDB(userId: string): Promise<UserInfoData> {
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

export async function getUserInfoData(userId: string): Promise<UserInfoData> {
  // 1. Try to read from cache
  const cachedData = await cacheService.get<UserInfoData>(
    `user-info:${userId}`
  );
  if (cachedData) {
    return cachedData;
  }

  // 2. On cache miss, read from DB
  const dbData = await fetchUserInfoFromDB(userId);

  // 3. Write data to cache (fire-and-forget)
  cacheService.set(`user-info:${userId}`, dbData);

  // 4. Return data from DB
  return dbData;
}

export async function updateUserBalance(
  userId: string,
  amount: number,
  type: "oil_balance" | "oil_ticket_balance"
): Promise<void> {
  await gachaDB
    .updateTable("gacha_users")
    .set({ [type]: sql`${sql.ref(type)} + ${amount}` })
    .where("user_id", "=", userId)
    .execute();

  await cacheService.del(`user-info:${userId}`);
}

export async function updateUserBalancesForTrade(
  senderId: string,
  receiverId: string,
  amount: number
): Promise<void> {
  await gachaDB.transaction().execute(async (trx) => {
    await trx
      .updateTable("gacha_users")
      .set({ oil_balance: sql`oil_balance - ${amount}` })
      .where("user_id", "=", senderId)
      .execute();

    await trx
      .updateTable("gacha_users")
      .set({ oil_balance: sql`oil_balance + ${amount}` })
      .where("user_id", "=", receiverId)
      .execute();
  });

  await Promise.all([
    cacheService.del(`user-info:${senderId}`),
    cacheService.del(`user-info:${receiverId}`),
  ]);
}
