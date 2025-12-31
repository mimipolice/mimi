import { sql } from "kysely";
import { gachaDB, mimiDLCDb } from "../shared/database";

interface PriceHistory {
  price: number;
  timestamp: Date;
}

interface Asset {
  name: string;
  symbol: string;
}

export interface AssetWithLatestPrice {
  asset_symbol: string;
  asset_name: string;
  price: number;
  timestamp: Date;
}

export interface AssetSummary {
  high: number;
  low: number;
  avg: number;
  startPrice: number;
  endPrice: number;
}

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

export async function getAllAssetsWithLatestPrice(): Promise<
  AssetWithLatestPrice[]
> {
  // 直接使用 virtual_assets.current_price，避免 JOIN 整個 asset_price_history 表進行排序
  const result = await gachaDB
    .selectFrom("virtual_assets")
    .select([
      "virtual_assets.asset_symbol",
      "virtual_assets.asset_name",
      "virtual_assets.current_price as price",
    ])
    .execute();

  return result.map((row) => ({
    asset_symbol: row.asset_symbol,
    asset_name: row.asset_name,
    price: Number(row.price),
    timestamp: new Date(), // current_price 本身就是最新價格，使用現在時間
  }));
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

export async function findNextAvailablePriceAlertId(): Promise<number> {
  const result = await mimiDLCDb
    .selectFrom("price_alerts")
    .select((eb) => eb.fn.max("id").as("max_id"))
    .executeTakeFirst();

  return (result?.max_id || 0) + 1;
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
      deprecation_notified: false,
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

export async function getAllPriceAlerts(
  notificationIntervalSeconds: number = 3600
): Promise<PriceAlert[]> {
  return await mimiDLCDb
    .selectFrom("price_alerts")
    .selectAll()
    .where("deprecation_notified", "=", false) // Only get alerts from users who haven't been notified yet
    .where((eb) =>
      eb.or([
        eb("last_notified_at", "is", null),
        eb.and([
          eb("repeatable", "=", true),
          sql<boolean>`last_notified_at < NOW() - INTERVAL '${sql.raw(
            `${notificationIntervalSeconds} seconds`
          )}'`,
        ]),
      ])
    )
    .execute();
}

export async function updatePriceAlertNotified(
  alertId: number
): Promise<bigint> {
  const result = await mimiDLCDb
    .updateTable("price_alerts")
    .set({ last_notified_at: new Date().toISOString() })
    .where("id", "=", alertId)
    // Only update if it hasn't been notified in the last 5 minutes
    // to prevent race conditions from other nodes.
    .where((eb) =>
      eb.or([
        eb("last_notified_at", "is", null),
        eb("last_notified_at", "<", sql`NOW() - INTERVAL '5 minutes'` as any),
      ])
    )
    .executeTakeFirst();

  return result?.numUpdatedRows ?? BigInt(0);
}

/**
 * Check if a user has already received the deprecation notice
 */
export async function hasUserReceivedDeprecationNotice(
  userId: string
): Promise<boolean> {
  const result = await mimiDLCDb
    .selectFrom("price_alerts")
    .select("deprecation_notified")
    .where("user_id", "=", userId)
    .where("deprecation_notified", "=", true)
    .limit(1)
    .executeTakeFirst();

  return !!result;
}

/**
 * Mark all alerts for a user as deprecation notified
 */
export async function markUserDeprecationNotified(
  userId: string
): Promise<void> {
  await mimiDLCDb
    .updateTable("price_alerts")
    .set({ deprecation_notified: true })
    .where("user_id", "=", userId)
    .execute();
}

// src/repositories/asset.repository.ts

// 新增這個 interface
export interface OhlcData {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap?: number; // 成交量加權平均價 (TimescaleDB candlestick_agg)
}


// 新增這個函數
export async function getOhlcPriceHistory(
  symbol: string,
  timeRange: string,
  intervalSeconds: number
): Promise<{ ohlcData: OhlcData[]; rawDataPointCount: number }> {
  // Helper function to apply time range filter
  const applyTimeRange = (query: any, timestampColumn: string) => {
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
          return query.where(
            timestampColumn,
            ">=",
            sql`NOW() - INTERVAL '${sql.raw(`${value} ${unit}`)}'` as any
          );
        }
      }
    }
    return query;
  };

  // 1. 取得時間範圍內的價格資料點
  let priceQuery = gachaDB
    .selectFrom("asset_price_history as aph")
    .innerJoin("virtual_assets as va", "aph.asset_id", "va.asset_id")
    .where("va.asset_symbol", "=", symbol)
    .select([
      "aph.price",
      "aph.timestamp",
      sql<Date>`to_timestamp(floor(extract('epoch' from aph.timestamp) / ${intervalSeconds}) * ${intervalSeconds})`.as(
        "time_bucket"
      ),
    ])
    .orderBy("aph.timestamp", "asc");
  priceQuery = applyTimeRange(priceQuery, "aph.timestamp");
  const priceHistory = await priceQuery.execute();

  // 2. 取得時間範圍內的成交量資料
  let volumeQuery = gachaDB
    .selectFrom("market_transactions as mt")
    .innerJoin("virtual_assets as va", "mt.asset_id", "va.asset_id")
    .where("va.asset_symbol", "=", symbol)
    .select([
      sql<Date>`to_timestamp(floor(extract('epoch' from mt.timestamp) / ${intervalSeconds}) * ${intervalSeconds})`.as(
        "time_bucket"
      ),
      sql<string>`SUM(mt.quantity)`.as("volume"),
    ])
    .groupBy("time_bucket");
  volumeQuery = applyTimeRange(volumeQuery, "mt.timestamp");
  const volumeHistory = await volumeQuery.execute();

  // 3. 在應用程式層級聚合數據
  const volumeMap = new Map(
    volumeHistory.map((v) => [v.time_bucket.getTime(), Number(v.volume)])
  );
  const ohlcMap = new Map<number, OhlcData>();

  for (const row of priceHistory) {
    const bucketTs = row.time_bucket.getTime();
    const price = Number(row.price);

    if (!ohlcMap.has(bucketTs)) {
      ohlcMap.set(bucketTs, {
        timestamp: new Date(bucketTs),
        open: price,
        high: price,
        low: price,
        close: price,
        volume: volumeMap.get(bucketTs) || 0,
      });
    } else {
      const candle = ohlcMap.get(bucketTs)!;
      candle.high = Math.max(candle.high, price);
      candle.low = Math.min(candle.low, price);
      candle.close = price; // 因為按時間排序，最後一筆就是收盤價
    }
  }

  const ohlcData = Array.from(ohlcMap.values()).sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );
  return {
    ohlcData,
    rawDataPointCount: priceHistory.length,
  };
}

// ============================================
// TimescaleDB Toolkit 超函數優化版本
// 需要安裝: CREATE EXTENSION IF NOT EXISTS timescaledb_toolkit;
// ============================================

/**
 * 解析時間範圍字串為 PostgreSQL INTERVAL 格式
 * @param timeRange - 時間範圍字串，如 "7d", "1m", "1y"
 * @returns PostgreSQL INTERVAL 字串，如 "7 days"
 */
function parseTimeRange(timeRange: string): string {
  if (timeRange === "all") return "100 years"; // 足夠長的時間範圍
  const match = timeRange.match(/^(\d+)([hdwmy])$/);
  if (!match) return "7 days";
  const value = parseInt(match[1], 10);
  const unitMap: Record<string, string> = {
    h: "hours",
    d: "days",
    w: "weeks",
    m: "months",
    y: "years",
  };
  const unit = unitMap[match[2]] || "days";
  return `${value} ${unit}`;
}

/**
 * 使用 TimescaleDB candlestick_agg() 計算 OHLCV + VWAP
 *
 * 優點：
 * - 單次掃描計算 open/high/low/close
 * - 自動計算 VWAP（成交量加權平均價）
 * - 比應用層聚合更高效
 *
 * @param symbol - 資產符號
 * @param timeRange - 時間範圍，如 "7d", "1m"
 * @param intervalStr - K線間隔，如 "30 minutes", "1 hour", "1 day"
 */
export async function getOhlcWithCandlestick(
  symbol: string,
  timeRange: string,
  intervalStr: string
): Promise<OhlcData[]> {
  const interval = parseTimeRange(timeRange);

  const result = await sql<{
    bucket: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    vwap: number;
    volume: string;
  }>`
    WITH candles AS (
      SELECT 
        time_bucket(${intervalStr}::interval, aph.timestamp) AS bucket,
        candlestick_agg(aph.timestamp, aph.price, 1.0) AS cs
      FROM asset_price_history aph
      JOIN virtual_assets va ON aph.asset_id = va.asset_id
      WHERE va.asset_symbol = ${symbol}
        AND aph.timestamp >= NOW() - INTERVAL '${sql.raw(interval)}'
      GROUP BY bucket
    ),
    volumes AS (
      SELECT
        time_bucket(${intervalStr}::interval, mt.timestamp) AS bucket,
        SUM(mt.quantity) AS volume
      FROM market_transactions mt
      JOIN virtual_assets va ON mt.asset_id = va.asset_id
      WHERE va.asset_symbol = ${symbol}
        AND mt.timestamp >= NOW() - INTERVAL '${sql.raw(interval)}'
      GROUP BY bucket
    )
    SELECT 
      c.bucket,
      open(c.cs) AS open,
      high(c.cs) AS high,
      low(c.cs) AS low,
      close(c.cs) AS close,
      vwap(c.cs) AS vwap,
      COALESCE(v.volume, 0) AS volume
    FROM candles c
    LEFT JOIN volumes v ON c.bucket = v.bucket
    ORDER BY c.bucket ASC
  `.execute(gachaDB);

  return result.rows.map((row) => ({
    timestamp: row.bucket,
    open: Number(row.open),
    high: Number(row.high),
    low: Number(row.low),
    close: Number(row.close),
    vwap: Number(row.vwap),
    volume: Number(row.volume),
  }));
}

/**
 * 使用 TimescaleDB LTTB (Largest Triangle Three Buckets) 降採樣
 *
 * 用於圖表渲染：將大量數據點壓縮到指定數量，同時保留視覺特徵
 * 例如：10萬筆 tick 數據 → 500 點，視覺上幾乎無損失
 *
 * @param symbol - 資產符號
 * @param timeRange - 時間範圍
 * @param targetPoints - 目標數據點數量（預設 500）
 */
export async function getDownsampledPrices(
  symbol: string,
  timeRange: string,
  targetPoints: number = 500
): Promise<{ timestamp: Date; price: number }[]> {
  const interval = parseTimeRange(timeRange);

  const result = await sql<{ time: Date; value: number }>`
    SELECT time, value AS price
    FROM unnest((
      SELECT lttb(
        aph.timestamp, 
        aph.price::float8, 
        ${targetPoints}
      )
      FROM asset_price_history aph
      JOIN virtual_assets va ON aph.asset_id = va.asset_id
      WHERE va.asset_symbol = ${symbol}
        AND aph.timestamp >= NOW() - INTERVAL '${sql.raw(interval)}'
    ))
  `.execute(gachaDB);

  return result.rows.map((row) => ({
    timestamp: row.time,
    price: Number(row.value),
  }));
}

/**
 * 價格統計結果介面
 */
export interface PriceStatistics {
  mean: number; // 平均價格
  stddev: number; // 標準差
  variance: number; // 變異數
  skewness: number; // 偏度（正值=右偏，負值=左偏）
  kurtosis: number; // 峰度（高值=尖峰厚尾）
}

/**
 * 使用 TimescaleDB stats_agg() 計算價格統計指標
 *
 * 可用於：
 * - 波動率分析（stddev, variance）
 * - 布林帶指標
 * - 風險評估（skewness, kurtosis）
 *
 * @param symbol - 資產符號
 * @param timeRange - 時間範圍
 */
export async function getPriceStatistics(
  symbol: string,
  timeRange: string
): Promise<PriceStatistics | null> {
  const interval = parseTimeRange(timeRange);

  const result = await sql<{
    mean: number;
    stddev: number;
    variance: number;
    skewness: number;
    kurtosis: number;
  }>`
    SELECT
      average(stats_agg(aph.price)) AS mean,
      stddev(stats_agg(aph.price)) AS stddev,
      variance(stats_agg(aph.price)) AS variance,
      skewness(stats_agg(aph.price)) AS skewness,
      kurtosis(stats_agg(aph.price)) AS kurtosis
    FROM asset_price_history aph
    JOIN virtual_assets va ON aph.asset_id = va.asset_id
    WHERE va.asset_symbol = ${symbol}
      AND aph.timestamp >= NOW() - INTERVAL '${sql.raw(interval)}'
  `.execute(gachaDB);

  const row = result.rows[0];
  if (!row || row.mean === null) {
    return null;
  }

  return {
    mean: Number(row.mean),
    stddev: Number(row.stddev),
    variance: Number(row.variance),
    skewness: Number(row.skewness),
    kurtosis: Number(row.kurtosis),
  };
}
