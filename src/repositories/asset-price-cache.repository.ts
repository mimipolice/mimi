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
 *
 * 優化: 使用 virtual_assets.current_price 取得當前價格，
 * 並用 LATERAL 子查詢只取每個資產的前一筆價格記錄
 */
export async function getAllAssetsWithPriceChange(): Promise<
  AssetPriceChange[]
> {
  // 使用原生 SQL 進行高效查詢：
  // 1. 從 virtual_assets 取得當前價格（current_price 欄位）
  // 2. 用 LATERAL JOIN 只取每個資產的第二新價格記錄
  const result = await sql<{
    asset_symbol: string;
    asset_name: string;
    current_price: string;
    previous_price: string | null;
  }>`
    SELECT 
      va.asset_symbol,
      va.asset_name,
      va.current_price,
      prev.price as previous_price
    FROM virtual_assets va
    LEFT JOIN LATERAL (
      SELECT aph.price
      FROM asset_price_history aph
      WHERE aph.asset_id = va.asset_id
      ORDER BY aph.timestamp DESC
      LIMIT 1 OFFSET 1
    ) prev ON true
  `.execute(gachaDB);

  return result.rows.map((row) => {
    const currentPrice = Number(row.current_price);
    const previousPrice = row.previous_price
      ? Number(row.previous_price)
      : currentPrice;

    const changePercent =
      previousPrice === 0
        ? 0
        : ((currentPrice - previousPrice) / previousPrice) * 100;

    return {
      asset_symbol: row.asset_symbol,
      asset_name: row.asset_name,
      current_price: currentPrice,
      previous_price: previousPrice,
      change_percent: changePercent,
      timestamp: new Date(),
    };
  });
}
