// config.js
// 用於儲存自動推播清單與其他可持久化設定

// 股票儲存配置
function getStockStorageConfig() {
  // 從環境變數讀取配置，預設為 both
  const storageMode = process.env.STOCK_STORAGE_MODE || "both";

  switch (storageMode.toLowerCase()) {
    case "db":
      return { db: true, json: false, both: false };
    case "json":
      return { db: false, json: true, both: false };
    case "both":
    default:
      return { db: true, json: true, both: true };
  }
}

module.exports = {
  getStockStorageConfig,
};
