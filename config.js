// config.js
// 用於儲存自動推播清單與其他可持久化設定

const fs = require("fs");
const path = require("path");

const CONFIG_PATH = path.resolve(__dirname, "bot_config.json");

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    const defaultConfig = { autoNotifySymbols: [] };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(defaultConfig, null, 2));
    return defaultConfig;
  }
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  } catch (e) {
    return { autoNotifySymbols: [] };
  }
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

module.exports = {
  CONFIG_PATH,
  loadConfig,
  saveConfig,
};
