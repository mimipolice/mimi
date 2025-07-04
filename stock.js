const dayjs = require("dayjs");
const fs = require("fs");
let fetch;
try {
  fetch = global.fetch || require("node-fetch");
  if (fetch.default) fetch = fetch.default;
} catch (e) {
  fetch = require("node-fetch");
  if (fetch.default) fetch = fetch.default;
}
const { getAutoNotifySymbols } = require("./config");
const { addAllStocksToSleepTracking } = require("./sleep");

const ALL_STOCK_DATA_PATH = "./allStockData.json";
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
  console.log("API 回傳資料型態:", Array.isArray(data), data);
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
  // 若有 symbol，則查詢該股票；否則查詢全部
  try {
    if (symbol) {
      return await queryStockHistoryBySymbol(symbol);
    } else {
      const data = await queryAllStockHistoryViaAPI();
      if (!Array.isArray(data)) throw new Error("API 回傳格式錯誤");
      return data;
    }
  } catch (e) {
    if (fs.existsSync(ALL_STOCK_DATA_PATH)) {
      try {
        const localData = JSON.parse(
          fs.readFileSync(ALL_STOCK_DATA_PATH, "utf8")
        );
        if (symbol) return localData.filter((d) => d.symbol === symbol);
        return localData;
      } catch (e) {
        console.error("❌ 無法讀取 allStockData.json", e);
        return [];
      }
    }
    return [];
  }
}

function saveAllStockHistory(history) {
  fs.writeFileSync(ALL_STOCK_DATA_PATH, JSON.stringify(history, null, 2));
}

async function addAllStocksToHistory(stocks) {
  // 寫入 JSON
  const history = fs.existsSync(ALL_STOCK_DATA_PATH)
    ? JSON.parse(fs.readFileSync(ALL_STOCK_DATA_PATH, "utf8"))
    : [];
  const now = dayjs();
  stocks.forEach((stock) => {
    history.push({
      time: now.toISOString(),
      ...stock,
    });
  });
  saveAllStockHistory(history);
  // 寫入 API
  await insertStocksViaAPI(stocks);
}

async function sendStockNotify(symbol, channel) {
  const all = await loadAllStockHistory(symbol); // 直接查詢該股票
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
  const CHANNEL_ID = "1386235399172522035";
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

module.exports = {
  parseStockField,
  loadAllStockHistory,
  saveAllStockHistory,
  addAllStocksToHistory,
  handleStockMessage,
  sendStockNotify,
  getLatestTimeFromAPI,
  queryStockHistoryBySymbol, // 新增: 可查詢單一股票
};
