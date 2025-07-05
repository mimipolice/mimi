// config.js
// 用於儲存自動推播清單與其他可持久化設定

const fs = require("fs");
const path = require("path");

const CONFIG_PATH = path.resolve(
  __dirname,
  "../../data/config/bot_config.json"
);

function loadConfig() {
  const defaultDebtChannelId =
    process.env.DEBT_CHANNEL_ID || "1390741771729899550";
  if (!fs.existsSync(CONFIG_PATH)) {
    const defaultConfig = {
      autoNotifySymbols: [],
      debtChannelId: defaultDebtChannelId,
    };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(defaultConfig, null, 2));
    return defaultConfig;
  }
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    if (config.debtChannelId === undefined) {
      config.debtChannelId = defaultDebtChannelId;
      saveConfig(config);
    }
    return config;
  } catch (e) {
    return { autoNotifySymbols: [], debtChannelId: defaultDebtChannelId };
  }
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function getAutoNotifySymbols() {
  return loadConfig().autoNotifySymbols || [];
}

function setAutoNotifySymbols(symbols) {
  const config = loadConfig();
  config.autoNotifySymbols = symbols;
  saveConfig(config);
}

function getDebtChannelId() {
  // 若 config 檔有就用，否則 fallback 到環境變數或預設
  return (
    loadConfig().debtChannelId ||
    process.env.DEBT_CHANNEL_ID ||
    "1390741771729899550"
  );
}

function setDebtChannelId(channelId) {
  const config = loadConfig();
  config.debtChannelId = channelId;
  saveConfig(config);
}

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
  CONFIG_PATH,
  loadConfig,
  saveConfig,
  getAutoNotifySymbols,
  setAutoNotifySymbols,
  getDebtChannelId,
  setDebtChannelId,
  getStockStorageConfig,
};
