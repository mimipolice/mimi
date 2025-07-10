// config.js
// 用於儲存自動推播清單與其他可持久化設定
const path = require("path");

// 應用程式配置
const APP_CONFIG = {
  // Discord 配置
  CHANNEL_ID: process.env.CHANNEL_ID || "1390554923862720572",
  TOKEN: process.env.TOKEN,

  // 檔案路徑配置
  PATHS: {
    ODOG_STATS: path.resolve(__dirname, "../../data/json/odog_stats.json"),
    KEYWORDS: path.resolve(__dirname, "../../data/json/keywords.json"),
    ALL_STOCK_DATA: path.resolve(__dirname, "../../data/json/allStockData.json"),
  },

  // 時間間隔配置
  INTERVALS: {
    STOCK_CHECK: 5 * 60 * 1000, // 5分鐘
    API_DELAY: 500, // API 請求間隔
  },

  // 稀有度映射
  RARITY_MAP: {
    "hsla(180": "EX",
    "hsla(0": "LR",
    "hsla(16": "UR",
    "hsla(51": "SSR",
  },

  // API 配置
  API_URL: process.env.API_URL || "https://cwds.taivs.tp.edu.tw/~cbs21/db/api.php",
};

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
  APP_CONFIG,
  getStockStorageConfig,
};
