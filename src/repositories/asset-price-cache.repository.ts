import { gachaDB } from "../shared/database";
import { sql } from "kysely";

export interface AssetPriceChange {
  asset_symbol: string;
  asset_name: string;
  current_price: number;
  previous_price: number;
  change_percent: number;
  timestamp: Date;
}

/**
 * 取得所有資產的最近兩次價格，用於計算漲跌幅
 * 這個函數會被快取，避免頻繁查詢資料庫
 */
export async function getAllAssetsWithPriceChange(): Promise<
  AssetPriceChange[]
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
    .select(["asset_symbol", "asset_name", "price", "timestamp", "rn"])
    .where("rn", "<=", 2) // 取最近兩筆
    .execute();

  // 將資料按 symbol 分組
  const groupedBySymbol = new Map<
    string,
    Array<{ price: number; timestamp: Date; asset_name: string }>
  >();

  for (const row of result) {
    const symbol = row.asset_symbol as string;
    if (!groupedBySymbol.has(symbol)) {
      groupedBySymbol.set(symbol, []);
    }
    groupedBySymbol.get(symbol)!.push({
      price: parseFloat(row.price as unknown as string),
      timestamp: row.timestamp as Date,
      asset_name: row.asset_name as string,
    });
  }

  // 計算漲跌幅
  const priceChanges: AssetPriceChange[] = [];

  for (const [symbol, prices] of groupedBySymbol.entries()) {
    if (prices.length === 0) continue;

    // 按時間排序（最新的在前）
    prices.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const current = prices[0];
    const previous = prices[1] || prices[0]; // 如果只有一筆，就用同一筆

    const changePercent =
      previous.price === 0
        ? 0
        : ((current.price - previous.price) / previous.price) * 100;

    priceChanges.push({
      asset_symbol: symbol,
      asset_name: current.asset_name,
      current_price: current.price,
      previous_price: previous.price,
      change_percent: changePercent,
      timestamp: current.timestamp,
    });
  }

  return priceChanges;
}
