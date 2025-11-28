import { sql } from "kysely";
import { gachaDB } from "../../shared/database";
import logger from "../../utils/logger";
import {
  CommandUsagePattern,
  ServerActivityTrend,
  CommandUsageByType,
} from "../../shared/database/types";

/**
 * 取得使用者的指令使用模式分析
 * 基於使用時間間隔來分析異常模式（無需 execution_time_ms）
 */
export async function getCommandUsagePatterns(
  userId: string
): Promise<CommandUsagePattern[]> {
  try {
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
      avg_execution_time: 0,
      execution_time_stddev: 0,
      min_execution_time: 0,
      max_execution_time: 0,
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
