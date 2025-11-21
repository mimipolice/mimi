import { sql } from "kysely";
import { CacheService } from "../services/CacheService";
import { gachaDB } from "../shared/database";
import logger from "../utils/logger";
import {
  PortfolioItem,
  SpendingBreakdown,
  TopReceiver,
  TopSender,
  UserInfoData,
  UserTopCommand,
  UserTopGuild,
  UserTransaction,
  CommandUsagePattern,
  TimePeriodFinancials,
  PeriodData,
  AnomalyData,
  AnomalyStatistics,
  ServerActivityTrend,
  CommandUsageByType,
} from "../shared/database/types";

const cacheService = new CacheService();

export async function getRecentTransactions(
  userId: string,
  offset: number,
  limit: number
): Promise<UserTransaction[]> {
  try {
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
  } catch (error) {
    logger.error(`[getRecentTransactions] Error fetching transactions for user ${userId}:`, {
      error: error instanceof Error ? error.message : String(error),
      userId,
      offset,
      limit,
    });
    return [];
  }
}

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
    
    // Return empty/default user info on error
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

/**
 * 取得使用者的指令使用模式分析
 * 基於使用時間間隔來分析異常模式（無需 execution_time_ms）
 */
export async function getCommandUsagePatterns(
  userId: string
): Promise<CommandUsagePattern[]> {
  try {
    // 使用 CTE 來計算每個指令的時間間隔
    const result = await gachaDB
      .with("intervals", (db) =>
        db
          .selectFrom("command_usage_stats")
          .select([
            "command_name",
            "used_at",
            sql<number>`EXTRACT(EPOCH FROM (used_at - LAG(used_at) OVER (PARTITION BY command_name ORDER BY used_at)))`.as(
              "interval_seconds"
            ),
          ])
          .where("user_id", "=", userId)
          .where("success", "=", true)
      )
      .selectFrom("intervals")
      .select([
        "command_name",
        sql<number>`COUNT(*)::int`.as("usage_count"),
        sql<number>`COALESCE(ROUND(AVG(interval_seconds)::numeric, 2), 0)`.as(
          "avg_interval_seconds"
        ),
        sql<number>`COALESCE(ROUND(STDDEV(interval_seconds)::numeric, 2), 0)`.as(
          "interval_stddev_seconds"
        ),
        sql<number>`COALESCE(MIN(interval_seconds), 0)`.as("min_interval_seconds"),
        sql<number>`COALESCE(MAX(interval_seconds), 0)`.as("max_interval_seconds"),
        sql<Date>`MAX(used_at)`.as("last_used_at"),
        sql<Date>`MIN(used_at)`.as("first_used_at"),
      ])
      .groupBy("command_name")
      .orderBy("usage_count", "desc")
      .execute();

    return result.map((row) => ({
      command_name: row.command_name,
      usage_count: row.usage_count,
      avg_execution_time: 0, // 不可用
      execution_time_stddev: 0, // 不可用
      min_execution_time: 0, // 不可用
      max_execution_time: 0, // 不可用
      avg_interval_seconds: row.avg_interval_seconds || 0,
      interval_stddev_seconds: row.interval_stddev_seconds || 0,
      last_used_at: row.last_used_at,
      first_used_at: row.first_used_at,
    }));
  } catch (error) {
    logger.error(`[getCommandUsagePatterns] Error fetching command usage patterns for user ${userId}:`, {
      error: error instanceof Error ? error.message : String(error),
      userId,
    });
    return [];
  }
}

/**
 * 取得使用者在特定時間範圍內的指令使用頻率
 * 用於檢測異常使用模式（如小帳刷指令）
 */
export async function getCommandUsageFrequency(
  userId: string,
  timeWindowMinutes: number = 60
): Promise<{
  command_name: string;
  usage_count: number;
  time_window_minutes: number;
}[]> {
  try {
    const cutoffTime = new Date(Date.now() - timeWindowMinutes * 60 * 1000);
    
    const result = await gachaDB
      .selectFrom("command_usage_stats")
      .select([
        "command_name",
        sql<number>`COUNT(*)::int`.as("usage_count"),
      ])
      .where("user_id", "=", userId)
      .where("success", "=", true)
      .where("used_at", ">", cutoffTime)
      .groupBy("command_name")
      .orderBy("usage_count", "desc")
      .execute();

    return result.map((row) => ({
      command_name: row.command_name,
      usage_count: row.usage_count,
      time_window_minutes: timeWindowMinutes,
    }));
  } catch (error) {
    logger.error(`[getCommandUsageFrequency] Error fetching command usage frequency for user ${userId}:`, {
      error: error instanceof Error ? error.message : String(error),
      userId,
      timeWindowMinutes,
    });
    return [];
  }
}

/**
 * 取得使用者在不同時間段的財務資料
 * 包含今日、本週、本月和總計的收入、支出、淨利和交易次數
 */
export async function getTimePeriodFinancials(
  userId: string
): Promise<TimePeriodFinancials> {
  try {
    const result = await gachaDB
      .selectFrom("user_transaction_history")
      .select([
        // Today
        sql<number>`COALESCE(SUM(CASE WHEN receiver_id = ${userId} AND created_at >= CURRENT_DATE THEN gross_amount ELSE 0 END), 0)`.as(
          "today_income"
        ),
        sql<number>`COALESCE(SUM(CASE WHEN sender_id = ${userId} AND created_at >= CURRENT_DATE THEN gross_amount ELSE 0 END), 0)`.as(
          "today_expense"
        ),
        sql<number>`COUNT(CASE WHEN (sender_id = ${userId} OR receiver_id = ${userId}) AND created_at >= CURRENT_DATE THEN 1 END)::int`.as(
          "today_count"
        ),

        // This Week (Monday 00:00 to now)
        sql<number>`COALESCE(SUM(CASE WHEN receiver_id = ${userId} AND created_at >= date_trunc('week', CURRENT_DATE) THEN gross_amount ELSE 0 END), 0)`.as(
          "week_income"
        ),
        sql<number>`COALESCE(SUM(CASE WHEN sender_id = ${userId} AND created_at >= date_trunc('week', CURRENT_DATE) THEN gross_amount ELSE 0 END), 0)`.as(
          "week_expense"
        ),
        sql<number>`COUNT(CASE WHEN (sender_id = ${userId} OR receiver_id = ${userId}) AND created_at >= date_trunc('week', CURRENT_DATE) THEN 1 END)::int`.as(
          "week_count"
        ),

        // This Month (1st 00:00 to now)
        sql<number>`COALESCE(SUM(CASE WHEN receiver_id = ${userId} AND created_at >= date_trunc('month', CURRENT_DATE) THEN gross_amount ELSE 0 END), 0)`.as(
          "month_income"
        ),
        sql<number>`COALESCE(SUM(CASE WHEN sender_id = ${userId} AND created_at >= date_trunc('month', CURRENT_DATE) THEN gross_amount ELSE 0 END), 0)`.as(
          "month_expense"
        ),
        sql<number>`COUNT(CASE WHEN (sender_id = ${userId} OR receiver_id = ${userId}) AND created_at >= date_trunc('month', CURRENT_DATE) THEN 1 END)::int`.as(
          "month_count"
        ),

        // All Time
        sql<number>`COALESCE(SUM(CASE WHEN receiver_id = ${userId} THEN gross_amount ELSE 0 END), 0)`.as(
          "all_income"
        ),
        sql<number>`COALESCE(SUM(CASE WHEN sender_id = ${userId} THEN gross_amount ELSE 0 END), 0)`.as(
          "all_expense"
        ),
        sql<number>`COUNT(CASE WHEN sender_id = ${userId} OR receiver_id = ${userId} THEN 1 END)::int`.as(
          "all_count"
        ),
      ])
      .where((eb) =>
        eb.or([eb("sender_id", "=", userId), eb("receiver_id", "=", userId)])
      )
      .executeTakeFirstOrThrow();

    const createPeriodData = (
      income: number,
      expense: number,
      count: number
    ): PeriodData => {
      // Task 11.4: 驗證並清理資料
      const sanitizedIncome = Math.max(0, Number(income) || 0);
      const sanitizedExpense = Math.max(0, Number(expense) || 0);
      const sanitizedCount = Math.max(0, Number(count) || 0);
      
      return {
        income: sanitizedIncome,
        expense: sanitizedExpense,
        netProfit: sanitizedIncome - sanitizedExpense,
        transactionCount: sanitizedCount,
      };
    };

    return {
      today: createPeriodData(
        result.today_income,
        result.today_expense,
        result.today_count
      ),
      week: createPeriodData(
        result.week_income,
        result.week_expense,
        result.week_count
      ),
      month: createPeriodData(
        result.month_income,
        result.month_expense,
        result.month_count
      ),
      all: createPeriodData(
        result.all_income,
        result.all_expense,
        result.all_count
      ),
    };
  } catch (error) {
    logger.error(`[getTimePeriodFinancials] Error fetching time period financials for user ${userId}:`, {
      error: error instanceof Error ? error.message : String(error),
      userId,
    });
    
    // Return empty data on error
    const emptyPeriod: PeriodData = {
      income: 0,
      expense: 0,
      netProfit: 0,
      transactionCount: 0,
    };
    return {
      today: emptyPeriod,
      week: emptyPeriod,
      month: emptyPeriod,
      all: emptyPeriod,
    };
  }
}

/**
 * 取得使用者的異常活動資料
 * 分析最近指定時間內的財務活動並與歷史平均值比較
 */
export async function getAnomalyData(
  userId: string,
  timeWindowHours: number = 24
): Promise<AnomalyData> {
  try {
    const cutoffTime = new Date(Date.now() - timeWindowHours * 60 * 60 * 1000);
    
    if (!userId) {
      throw new Error('User ID is required');
    }

    // Get recent activity and historical averages
    const result = await gachaDB
      .with("recent_activity", (db) =>
        db
          .selectFrom("user_transaction_history")
          .select([
            "sender_id",
            "receiver_id",
            "gross_amount",
            "created_at",
            sql<string>`CASE WHEN sender_id = ${userId} THEN 'outgoing' ELSE 'incoming' END`.as(
              "direction"
            ),
          ])
          .where((eb) =>
            eb.or([
              eb("sender_id", "=", userId),
              eb("receiver_id", "=", userId),
            ])
          )
          .where("created_at", ">=", cutoffTime)
      )
      .with("historical_avg", (db) =>
        db
          .selectFrom(
            db
              .selectFrom("user_transaction_history")
              .select([
                sql<string>`DATE(created_at)`.as("date"),
                sql<number>`SUM(CASE WHEN receiver_id = ${userId} THEN gross_amount ELSE 0 END)`.as(
                  "daily_income"
                ),
                sql<number>`SUM(CASE WHEN sender_id = ${userId} THEN gross_amount ELSE 0 END)`.as(
                  "daily_expense"
                ),
                sql<number>`COUNT(*)`.as("daily_count"),
              ])
              .where((eb) =>
                eb.or([
                  eb("sender_id", "=", userId),
                  eb("receiver_id", "=", userId),
                ])
              )
              .where("created_at", "<", cutoffTime)
              .where(
                "created_at",
                ">=",
                new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
              )
              .groupBy(sql`DATE(created_at)`)
              .as("daily_stats")
          )
          .select([
            sql<number>`COALESCE(AVG(daily_income), 0)`.as("avg_daily_income"),
            sql<number>`COALESCE(AVG(daily_expense), 0)`.as("avg_daily_expense"),
            sql<number>`COALESCE(AVG(daily_count), 0)`.as("avg_daily_count"),
          ])
      )
      .selectFrom("recent_activity")
      .select([
        sql<number>`COALESCE(SUM(CASE WHEN direction = 'incoming' THEN gross_amount ELSE 0 END), 0)`.as(
          "recent_income"
        ),
        sql<number>`COALESCE(SUM(CASE WHEN direction = 'outgoing' THEN gross_amount ELSE 0 END), 0)`.as(
          "recent_expense"
        ),
        sql<number>`COUNT(*)::int`.as("recent_count"),
        (eb) =>
          eb
            .selectFrom("historical_avg")
            .select("avg_daily_income")
            .as("avg_daily_income"),
        (eb) =>
          eb
            .selectFrom("historical_avg")
            .select("avg_daily_expense")
            .as("avg_daily_expense"),
        (eb) =>
          eb
            .selectFrom("historical_avg")
            .select("avg_daily_count")
            .as("avg_daily_count"),
      ])
      .executeTakeFirst();

    // Get large transactions (>50K)
    const largeTransactions = await gachaDB
      .selectFrom("user_transaction_history")
      .select([
        sql<string>`CASE WHEN sender_id = ${userId} THEN 'outgoing' ELSE 'incoming' END`.as(
          "direction"
        ),
        "gross_amount",
        sql<string>`CASE WHEN sender_id = ${userId} THEN receiver_id ELSE sender_id END`.as(
          "partner_id"
        ),
        "created_at",
      ])
      .where((eb) =>
        eb.or([eb("sender_id", "=", userId), eb("receiver_id", "=", userId)])
      )
      .where("created_at", ">=", cutoffTime)
      .where("gross_amount", ">", 50000)
      .orderBy("gross_amount", "desc")
      .execute();

    // Get top income partners
    const topIncomePartners = await gachaDB
      .selectFrom("user_transaction_history")
      .select([
        "sender_id",
        sql<number>`SUM(gross_amount)`.as("total_amount"),
        sql<number>`COUNT(*)::int`.as("count"),
      ])
      .where("receiver_id", "=", userId)
      .where("sender_id", "!=", userId)
      .where("created_at", ">=", cutoffTime)
      .groupBy("sender_id")
      .orderBy("total_amount", "desc")
      .limit(10)
      .execute();

    // Get top expense partners
    const topExpensePartners = await gachaDB
      .selectFrom("user_transaction_history")
      .select([
        "receiver_id",
        sql<number>`SUM(gross_amount)`.as("total_amount"),
        sql<number>`COUNT(*)::int`.as("count"),
      ])
      .where("sender_id", "=", userId)
      .where("receiver_id", "!=", userId)
      .where("created_at", ">=", cutoffTime)
      .groupBy("receiver_id")
      .orderBy("total_amount", "desc")
      .limit(10)
      .execute();

    // Task 11.4: 驗證並清理資料
    const statistics: AnomalyStatistics = {
      recentIncome: Math.max(0, Number(result?.recent_income) || 0),
      recentExpense: Math.max(0, Number(result?.recent_expense) || 0),
      recentCount: Math.max(0, Number(result?.recent_count) || 0),
      avgDailyIncome: Math.max(0, Number(result?.avg_daily_income) || 0),
      avgDailyExpense: Math.max(0, Number(result?.avg_daily_expense) || 0),
      avgDailyCount: Math.max(0, Number(result?.avg_daily_count) || 0),
      largeTransactions: largeTransactions.map((tx) => ({
        direction: tx.direction as 'incoming' | 'outgoing',
        amount: Math.max(0, Number(tx.gross_amount) || 0),
        partnerId: tx.partner_id,
        createdAt: tx.created_at,
      })),
      topIncomePartners: topIncomePartners.map((p) => ({
        partnerId: p.sender_id,
        amount: Math.max(0, Number(p.total_amount) || 0),
        count: Math.max(0, Number(p.count) || 0),
      })),
      topExpensePartners: topExpensePartners.map((p) => ({
        partnerId: p.receiver_id,
        amount: Math.max(0, Number(p.total_amount) || 0),
        count: Math.max(0, Number(p.count) || 0),
      })),
    };

    // Calculate risk score
    let riskScore = 0;

    // Abnormal income (max 30 points)
    if (statistics.recentIncome > 100000) {
      riskScore += 30;
    } else if (statistics.recentIncome > 50000) {
      riskScore += 20;
    }

    // Abnormal expense (max 30 points)
    if (statistics.recentExpense > 100000) {
      riskScore += 30;
    } else if (statistics.recentExpense > 50000) {
      riskScore += 20;
    }

    // High frequency (max 20 points)
    if (statistics.recentCount > 50) {
      riskScore += 20;
    } else if (statistics.recentCount > 30) {
      riskScore += 10;
    }

    // Large transactions (max 15 points)
    if (statistics.largeTransactions.length > 0) {
      riskScore += Math.min(15, statistics.largeTransactions.length * 5);
    }

    // Historical comparison (max 25 points)
    const incomeMultiplier =
      statistics.avgDailyIncome > 0
        ? statistics.recentIncome / statistics.avgDailyIncome
        : 0;
    const expenseMultiplier =
      statistics.avgDailyExpense > 0
        ? statistics.recentExpense / statistics.avgDailyExpense
        : 0;

    if (incomeMultiplier >= 3 || expenseMultiplier >= 3) {
      riskScore += 25;
    } else if (incomeMultiplier >= 2 || expenseMultiplier >= 2) {
      riskScore += 15;
    }

    riskScore = Math.min(100, riskScore);

    // Determine risk level
    let riskLevel: 'high' | 'medium' | 'low' | 'normal';
    if (riskScore >= 80) {
      riskLevel = 'high';
    } else if (riskScore >= 50) {
      riskLevel = 'medium';
    } else if (riskScore >= 30) {
      riskLevel = 'low';
    } else {
      riskLevel = 'normal';
    }

    return {
      riskScore,
      riskLevel,
      statistics,
    };
  } catch (error) {
    logger.error(`[getAnomalyData] Error fetching anomaly data for user ${userId}:`, {
      error: error instanceof Error ? error.message : String(error),
      userId,
      timeWindowHours,
    });
    
    // Return safe default on error
    return {
      riskScore: 0,
      riskLevel: 'normal',
      statistics: {
        recentIncome: 0,
        recentExpense: 0,
        recentCount: 0,
        avgDailyIncome: 0,
        avgDailyExpense: 0,
        avgDailyCount: 0,
        largeTransactions: [],
        topIncomePartners: [],
        topExpensePartners: [],
      },
    };
  }
}

/**
 * 取得使用者在各伺服器的活動趨勢
 * 比較最近 7 天與前 7 天的活動變化
 */
export async function getServerActivityTrends(
  userId: string
): Promise<ServerActivityTrend[]> {
  try {
    const result = await gachaDB
      .with("recent_activity", (db) =>
        db
          .selectFrom("command_usage_stats")
          .select([
            "guild_id",
            sql<number>`COUNT(*)::int`.as("recent_count"),
          ])
          .where("user_id", "=", userId)
          .where("used_at", ">=", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
          .groupBy("guild_id")
      )
      .with("previous_activity", (db) =>
        db
          .selectFrom("command_usage_stats")
          .select([
            "guild_id",
            sql<number>`COUNT(*)::int`.as("previous_count"),
          ])
          .where("user_id", "=", userId)
          .where("used_at", ">=", new Date(Date.now() - 14 * 24 * 60 * 60 * 1000))
          .where("used_at", "<", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
          .groupBy("guild_id")
      )
      .selectFrom("recent_activity")
      .fullJoin("previous_activity", "recent_activity.guild_id", "previous_activity.guild_id")
      .select([
        sql<string>`COALESCE(recent_activity.guild_id, previous_activity.guild_id)`.as(
          "guild_id"
        ),
        sql<number>`COALESCE(recent_activity.recent_count, 0)`.as("recent_count"),
        sql<number>`COALESCE(previous_activity.previous_count, 0)`.as(
          "previous_count"
        ),
        sql<number>`CASE 
          WHEN COALESCE(previous_activity.previous_count, 0) > 0 THEN
            ((COALESCE(recent_activity.recent_count, 0) - COALESCE(previous_activity.previous_count, 0))::float / COALESCE(previous_activity.previous_count, 1) * 100)
          ELSE 0
        END`.as("change_percentage"),
      ])
      .orderBy("recent_count", "desc")
      .execute();

    return result.map((row) => ({
      guildId: row.guild_id,
      recentCount: Number(row.recent_count) || 0,
      previousCount: Number(row.previous_count) || 0,
      changePercentage: Number(row.change_percentage) || 0,
    }));
  } catch (error) {
    logger.error(`[getServerActivityTrends] Error fetching server activity trends for user ${userId}:`, {
      error: error instanceof Error ? error.message : String(error),
      userId,
    });
    return [];
  }
}

/**
 * 取得使用者的所有指令使用記錄
 * 用於後續的指令類型分類分析
 */
export async function getCommandUsageByType(
  userId: string
): Promise<CommandUsageByType[]> {
  try {
    const result = await gachaDB
      .selectFrom("command_usage_stats")
      .select([
        "command_name",
        sql<number>`COUNT(*)::int`.as("usage_count"),
      ])
      .where("user_id", "=", userId)
      .groupBy("command_name")
      .orderBy("usage_count", "desc")
      .execute();

    return result.map((row) => ({
      commandName: row.command_name,
      usageCount: Number(row.usage_count) || 0,
    }));
  } catch (error) {
    logger.error(`[getCommandUsageByType] Error fetching command usage by type for user ${userId}:`, {
      error: error instanceof Error ? error.message : String(error),
      userId,
    });
    return [];
  }
}
