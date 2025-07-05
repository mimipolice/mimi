const dayjs = require("dayjs");
const fs = require("fs");
const path = require("path");
let fetch;
try {
  fetch = global.fetch || require("node-fetch");
  if (fetch.default) fetch = fetch.default;
} catch (e) {
  fetch = require("node-fetch");
  if (fetch.default) fetch = fetch.default;
}
const {
  getAutoNotifySymbols,
  getStockStorageConfig,
} = require("../core/config");
const { addAllStocksToSleepTracking } = require("./sleep");

const ALL_STOCK_DATA_PATH = path.resolve(
  __dirname,
  "../../data/json/allStockData.json"
);
const USER_ID = "586502118530351114";
const API_URL = "https://cwds.taivs.tp.edu.tw/~cbs21/db/api.php"; // 請依實際部署位置調整

async function insertStocksViaAPI(stocks) {
  for (const stock of stocks) {
    const payload = {
      time: dayjs().format("YYYY-MM-DD HH:mm:ss"),
      ...stock,
    };
    await fetch(`${API_URL}?action=insert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }
}

async function queryAllStockHistoryViaAPI() {
  const res = await fetch(`${API_URL}?action=query`);
  if (!res.ok) throw new Error("API 查詢失敗");
  const data = await res.json();
  //console.log("API 回傳資料型態:", Array.isArray(data), data);
  return data;
}

async function getLatestTimeFromAPI() {
  const res = await fetch(`${API_URL}?action=latest_time`);
  if (!res.ok) throw new Error("API 查詢失敗");
  const data = await res.json();
  return data.latest_time;
}

function parseStockField(rawValue) {
  const lines = rawValue.split("\n");
  const headerMatch = lines[0] && lines[0].match(/\*\*(.+)\*\* - (.+)/);
  if (!headerMatch) return null;
  const symbol = headerMatch[1];
  const name = headerMatch[2];
  const priceMatch = lines[1] && lines[1].match(/價格 : `([\d.]+)`/);
  const price = priceMatch ? parseFloat(priceMatch[1]) : null;
  const changeMatch = lines[2] && lines[2].match(/趨勢 : `([+-]?[\d.]+)%`/);
  const changePercent = changeMatch ? parseFloat(changeMatch[1]) : null;
  const volumeMatch = lines[3] && lines[3].match(/成交量 : `([\d,]+)`/);
  const volume = volumeMatch
    ? parseInt(volumeMatch[1].replace(/,/g, ""))
    : null;
  return { symbol, name, price, changePercent, volume };
}

async function queryStockHistoryBySymbol(symbol, limit = 1000, offset = 0) {
  const url = `${API_URL}?action=query&symbol=${encodeURIComponent(
    symbol
  )}&limit=${limit}&offset=${offset}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("API 查詢失敗");
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error("API 回傳格式錯誤");
  return data;
}

async function loadAllStockHistory(symbol = null) {
  const storageConfig = getStockStorageConfig();

  // 優先從 API/DB 讀取
  if (storageConfig.db || storageConfig.both) {
    try {
      if (symbol) {
        return await queryStockHistoryBySymbol(symbol);
      } else {
        const data = await queryAllStockHistoryViaAPI();
        if (!Array.isArray(data)) throw new Error("API 回傳格式錯誤");
        return data;
      }
    } catch (e) {
      console.error("❌ API 查詢失敗，嘗試從 JSON 讀取:", e.message);
    }
  }

  // 從 JSON 讀取
  if (storageConfig.json || storageConfig.both) {
    if (fs.existsSync(ALL_STOCK_DATA_PATH)) {
      try {
        const localData = JSON.parse(
          fs.readFileSync(ALL_STOCK_DATA_PATH, "utf8")
        );
        if (symbol) return localData.filter((d) => d.symbol === symbol);
        return localData;
      } catch (e) {
        console.error("❌ 無法讀取 allStockData.json", e);
      }
    }
  }

  return [];
}

function saveAllStockHistory(history) {
  fs.writeFileSync(ALL_STOCK_DATA_PATH, JSON.stringify(history, null, 2));
}

async function addAllStocksToHistory(stocks) {
  const storageConfig = getStockStorageConfig();
  const now = dayjs();

  // 寫入 JSON
  if (storageConfig.json || storageConfig.both) {
    const history = fs.existsSync(ALL_STOCK_DATA_PATH)
      ? JSON.parse(fs.readFileSync(ALL_STOCK_DATA_PATH, "utf8"))
      : [];
    stocks.forEach((stock) => {
      history.push({
        time: now.toISOString(),
        ...stock,
      });
    });
    saveAllStockHistory(history);
    console.log("📄 已儲存到 JSON");
  }

  // 寫入 API/DB
  if (storageConfig.db || storageConfig.both) {
    try {
      await insertStocksViaAPI(stocks);
      console.log("🗄️ 已儲存到資料庫");
    } catch (error) {
      console.error("❌ 資料庫儲存失敗:", error.message);
    }
  }
}

async function sendStockNotify(symbol, channel) {
  const all = await loadAllStockHistory(symbol);
  if (!Array.isArray(all)) return;
  const data = all;
  if (data.length === 0) return;
  const latest = data[data.length - 1];
  const now = dayjs();
  const getPricesWithin = (minutes) =>
    data
      .filter((d) => now.diff(dayjs(d.time), "minute") <= minutes)
      .map((d) => d.price);
  const prices15 = getPricesWithin(15);
  const prices30 = getPricesWithin(30);
  const prices60 = getPricesWithin(60);
  const prices120 = getPricesWithin(120);
  const allPrices = data.map((d) => d.price);
  const high15 = Math.max(...prices15);
  const low15 = Math.min(...prices15);
  const high30 = Math.max(...prices30);
  const low30 = Math.min(...prices30);
  const high60 = Math.max(...prices60);
  const low60 = Math.min(...prices60);
  const high120 = Math.max(...prices120);
  const low120 = Math.min(...prices120);
  const historyHigh = Math.max(...allPrices);
  const historyLow = Math.min(...allPrices);
  let messageText = `<@${USER_ID}>\n\n# **${symbol} 價格警報**\n`;
  messageText += `\n> **${latest.name}**`;
  messageText += `\n\n# <:emoji_1:1309461021420683284> **當前價格：\`${latest.price}\`**`;
  messageText += `\n\n# ━━━━━━━━━━━━━━━━━━`;
  messageText += `\n# **價格統計**`;
  messageText += `\n# <:emoji_12:1309461481095430196> 歷史高點：\`${historyHigh}\``;
  messageText += `\n# <:emoji_6:1309461163200745504> 歷史低點：\`${historyLow}\``;
  messageText += `\n\n# **區間極值**`;
  messageText += `\n# <:__:1318631658353852527> 2小時內：\`${high120}\` ~ \`${low120}\``;
  messageText += `\n# <:__:1318631705824722985> 1小時內：\`${high60}\` ~ \`${low60}\``;
  messageText += `\n# <:__:1318631296687145090> 30分鐘內：\`${high30}\` ~ \`${low30}\``;
  messageText += `\n# <:__:1318630891462856755> 15分鐘內：\`${high15}\` ~ \`${low15}\``;
  messageText += `\n\n# <:emoji_12:1309461317744201789> 查詢時間：${now.format(
    "YYYY-MM-DD HH:mm:ss"
  )}`;
  await channel.send(messageText);
}

function handleStockMessage(message) {
  const CHANNEL_ID = "1390554923862720572";
  if (message.channelId !== CHANNEL_ID) return;
  if (!message.embeds || message.embeds.length === 0) return;
  const embed = message.embeds[0];
  if (!embed.fields || embed.fields.length === 0) return;
  const stocks = [];
  for (const field of embed.fields) {
    const stock = parseStockField(field.rawValue || field.value);
    if (stock) stocks.push(stock);
  }
  if (stocks.length > 0) {
    addAllStocksToHistory(stocks);
    console.log(`📊 已記錄 ${stocks.length} 支股票資訊`);
    addAllStocksToSleepTracking(stocks, dayjs());
    const autoNotifySymbols = getAutoNotifySymbols();
    for (const stock of stocks) {
      if (autoNotifySymbols.includes(stock.symbol)) {
        sendStockNotify(stock.symbol, message.channel);
      }
    }
  }
}

// 單獨執行時的邏輯
async function runStandalone() {
  console.log("🚀 股票監控程式啟動（獨立模式）");

  // 檢查是否為獨立執行
  if (require.main === module) {
    const { Client } = require("discord.js-selfbot-v13");
    require("dotenv").config();

    const client = new Client();
    const CHANNEL_ID = "1390554923862720572";
    const TOKEN = process.env.TOKEN;

    function triggerStockCommand(channel) {
      try {
        channel.sendSlash("1221230734602141727", "stock");
        console.log("📤 已發送 /stock 指令");
      } catch (err) {
        console.error("❌ /stock 指令發送失敗:", err);
      }
    }

    client.on("ready", () => {
      console.log(`✅ Bot 已上線: ${client.user.tag}`);

      const channel = client.channels.cache.get(CHANNEL_ID);
      if (!channel) return console.error("⚠️ 找不到頻道");

      // 啟動時立即執行
      triggerStockCommand(channel);

      // 每5分鐘自動查價
      setInterval(() => {
        triggerStockCommand(channel);
      }, 5 * 60 * 1000);
    });

    client.on("messageCreate", async (message) => {
      handleStockMessage(message);
    });

    client.login(TOKEN);
  }
}

// 如果直接執行此檔案，則啟動獨立模式
if (require.main === module) {
  runStandalone();
}

module.exports = {
  parseStockField,
  loadAllStockHistory,
  saveAllStockHistory,
  addAllStocksToHistory,
  handleStockMessage,
  sendStockNotify,
  getLatestTimeFromAPI,
  queryStockHistoryBySymbol,
  runStandalone,
};
