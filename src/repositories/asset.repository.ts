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

// src/repositories/asset.repository.ts

// 新增這個 interface
export interface OhlcData {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// 新增這個函數
export async function getOhlcPriceHistory(
  symbol: string,
  timeRange: string,
  intervalSeconds: number
): Promise<OhlcData[]> {
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

  return Array.from(ohlcMap.values()).sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );
}
