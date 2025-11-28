import { sql } from "kysely";
import { gachaDB } from "../../shared/database";
import logger from "../../utils/logger";
import {
  TimePeriodFinancials,
  PeriodData,
  AnomalyData,
  AnomalyStatistics,
} from "../../shared/database/types";

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
