const dayjs = require("dayjs");
const fs = require("fs");
const { getAutoNotifySymbols } = require("./config");
const { addAllStocksToSleepTracking } = require("./sleep");

const ALL_STOCK_DATA_PATH = "./allStockData.json";
const USER_ID = "586502118530351114";

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

function loadAllStockHistory() {
  if (!fs.existsSync(ALL_STOCK_DATA_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(ALL_STOCK_DATA_PATH, "utf8"));
  } catch (e) {
    console.error("❌ 無法讀取 allStockData.json", e);
    return [];
  }
}

function saveAllStockHistory(history) {
  fs.writeFileSync(ALL_STOCK_DATA_PATH, JSON.stringify(history, null, 2));
}

function addAllStocksToHistory(stocks) {
  const history = loadAllStockHistory();
  const now = dayjs();
  stocks.forEach((stock) => {
    history.push({
      time: now.toISOString(),
      ...stock,
    });
  });
  saveAllStockHistory(history);
}

async function sendStockNotify(symbol, channel) {
  const all = loadAllStockHistory();
  const data = all.filter((d) => d.symbol === symbol);
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
};
