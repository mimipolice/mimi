const { Client, MessageAttachment } = require("discord.js-selfbot-v13");
const dayjs = require("dayjs");
const fs = require("fs");
const { createCanvas } = require("canvas");
const { loadConfig, saveConfig } = require("./config");
require("dotenv").config();

const client = new Client();

const CHANNEL_ID = "1386235399172522035"; // 更換為你的頻道 ID
const USER_ID = "586502118530351114"; // 更換為你要提醒的用戶 ID
const TOKEN = process.env.TOKEN;

const SLEEP_DATA_PATH = "./sleepData.json";
const ALL_STOCK_DATA_PATH = "./allStockData.json";

// 自動推播清單，記錄哪些股票要自動推播（改為持久化）
let { autoNotifySymbols } = loadConfig();

function updateAutoNotifySymbols(symbols) {
  autoNotifySymbols = symbols;
  const config = loadConfig();
  config.autoNotifySymbols = autoNotifySymbols;
  saveConfig(config);
}

// 自動推播清單 getter/setter，確保每次都與 config 檔案同步
function getAutoNotifySymbols() {
  return loadConfig().autoNotifySymbols || [];
}
function setAutoNotifySymbols(symbols) {
  const config = loadConfig();
  config.autoNotifySymbols = symbols;
  saveConfig(config);
}

function loadSleepData() {
  if (!fs.existsSync(SLEEP_DATA_PATH))
    return { isTracking: false, startTime: null, data: [] };
  try {
    const data = JSON.parse(fs.readFileSync(SLEEP_DATA_PATH, "utf8"));
    return {
      ...data,
      startTime: data.startTime ? dayjs(data.startTime) : null,
      data: data.data.map((item) => ({ ...item, time: dayjs(item.time) })),
    };
  } catch (e) {
    console.error("❌ 無法讀取 sleepData.json", e);
    return { isTracking: false, startTime: null, data: [] };
  }
}

function saveSleepData(sleepData) {
  fs.writeFileSync(
    SLEEP_DATA_PATH,
    JSON.stringify(
      {
        isTracking: sleepData.isTracking,
        startTime: sleepData.startTime
          ? sleepData.startTime.toISOString()
          : null,
        data: sleepData.data.map((item) => ({
          time: item.time.toISOString(),
          // 儲存完整股票資訊
          symbol: item.symbol,
          name: item.name,
          price: item.price,
          changePercent: item.changePercent,
          volume: item.volume,
        })),
      },
      null,
      2
    )
  );
}

function startSleepTracking() {
  const sleepData = {
    isTracking: true,
    startTime: dayjs(),
    data: [],
  };
  saveSleepData(sleepData);
  console.log("🛏️ 開始睡眠追蹤");
}

function stopSleepTracking() {
  const sleepData = loadSleepData();
  if (!sleepData.isTracking) return null;

  const endTime = dayjs();
  const trackingData = {
    startTime: sleepData.startTime,
    endTime: endTime,
    data: [...sleepData.data],
  };

  const newSleepData = { isTracking: false, startTime: null, data: [] };
  saveSleepData(newSleepData);

  console.log("⏰ 結束睡眠追蹤");
  return trackingData;
}

function addPriceToSleepTracking(price, time) {
  const sleepData = loadSleepData();
  if (sleepData.isTracking) {
    sleepData.data.push({ time, price });
    saveSleepData(sleepData);
  }
}

function addAllStocksToSleepTracking(stocks, time) {
  const sleepData = loadSleepData();
  if (sleepData.isTracking) {
    stocks.forEach((stock) => {
      sleepData.data.push({ time, ...stock });
    });
    saveSleepData(sleepData);
  }
}

function analyzeSleepData(trackingData) {
  if (!trackingData || trackingData.data.length === 0) {
    return { error: "沒有足夠的數據進行分析" };
  }
  // 以 symbol 分組，並依時間排序
  const grouped = {};
  trackingData.data.forEach((d) => {
    if (!d.symbol) return; // 忽略沒有 symbol 的資料
    if (!grouped[d.symbol]) grouped[d.symbol] = { name: d.name, data: [] };
    grouped[d.symbol].data.push(d);
  });
  // 回傳所有股票的分析結果陣列
  return Object.entries(grouped).map(([symbol, group]) => {
    // 只分析該股票在這段期間的資料，並依時間排序
    const data = group.data
      .map((d) => ({ ...d, time: dayjs(d.time) }))
      .sort((a, b) => a.time.valueOf() - b.time.valueOf());
    if (data.length === 0) return { error: `股票 ${symbol} 沒有數據` };
    const prices = data.map((d) => d.price);
    const startPrice = data[0].price;
    const endPrice = data[data.length - 1].price;
    const highPrice = Math.max(...prices);
    const lowPrice = Math.min(...prices);
    const totalChange = endPrice - startPrice;
    const totalChangePercent = (totalChange / startPrice) * 100;
    const highChangePercent = ((highPrice - startPrice) / startPrice) * 100;
    const lowChangePercent = ((lowPrice - startPrice) / startPrice) * 100;
    const volatility = highPrice - lowPrice;
    const volatilityPercent = (volatility / startPrice) * 100;
    const avgPrice =
      prices.reduce((sum, price) => sum + price, 0) / prices.length;
    const highIndex = data.findIndex((d) => d.price === highPrice);
    const lowIndex = data.findIndex((d) => d.price === lowPrice);
    const highTime = data[highIndex].time;
    const lowTime = data[lowIndex].time;
    const sleepDuration = trackingData.endTime.diff(
      trackingData.startTime,
      "hour",
      true
    );
    return {
      symbol,
      name: group.name,
      startTime: trackingData.startTime.format("YYYY-MM-DD HH:mm:ss"),
      endTime: trackingData.endTime.format("YYYY-MM-DD HH:mm:ss"),
      sleepDuration: sleepDuration.toFixed(1),
      startPrice: startPrice.toFixed(2),
      endPrice: endPrice.toFixed(2),
      highPrice: highPrice.toFixed(2),
      lowPrice: lowPrice.toFixed(2),
      totalChange: totalChange.toFixed(2),
      totalChangePercent: totalChangePercent.toFixed(2),
      highChangePercent: highChangePercent.toFixed(2),
      lowChangePercent: lowChangePercent.toFixed(2),
      volatility: volatility.toFixed(2),
      volatilityPercent: volatilityPercent.toFixed(2),
      avgPrice: avgPrice.toFixed(2),
      highTime: highTime.format("HH:mm:ss"),
      lowTime: lowTime.format("HH:mm:ss"),
      dataPoints: data.length,
      priceData: data,
    };
  });
}

async function createSleepChart(analysis, showFullTimeAxis = false) {
  const canvas = createCanvas(800, 600);
  const ctx = canvas.getContext("2d");

  // 取得股票名稱與代碼
  const symbol = analysis.symbol || "?";
  const name = analysis.name || "?";

  // 背景
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(0, 0, 800, 600);

  // 標題
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 24px Arial";
  ctx.textAlign = "center";
  ctx.fillText(`${symbol} - ${name} 睡眠期間價格走勢`, 400, 40);

  // 基本資訊
  ctx.font = "14px Arial";
  ctx.textAlign = "left";
  ctx.fillStyle = "#cccccc";
  const infoY = 70;
  ctx.fillText(
    `睡眠時間: ${analysis.startTime} ~ ${analysis.endTime}`,
    50,
    infoY
  );
  ctx.fillText(`睡眠時長: ${analysis.sleepDuration} 小時`, 50, infoY + 20);
  ctx.fillText(`數據點數: ${analysis.dataPoints} 個`, 50, infoY + 40);

  // 圖表區域
  const chartX = 60;
  const chartY = 130;
  const chartWidth = 680;
  const chartHeight = 300;

  // 圖表邊框
  ctx.strokeStyle = "#555555";
  ctx.lineWidth = 1;
  ctx.strokeRect(chartX, chartY, chartWidth, chartHeight);

  // 價格數據
  const prices = analysis.priceData.map((d) => d.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice;

  if (priceRange > 0) {
    // 繪製價格線
    ctx.strokeStyle = analysis.totalChange >= 0 ? "#00ff88" : "#ff4444";
    ctx.lineWidth = 2;
    ctx.beginPath();

    analysis.priceData.forEach((point, index) => {
      const x = chartX + (index / (analysis.priceData.length - 1)) * chartWidth;
      const y =
        chartY +
        chartHeight -
        ((point.price - minPrice) / priceRange) * chartHeight;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // 標記最高點和最低點
    const highIndex = prices.findIndex(
      (p) => p === parseFloat(analysis.highPrice)
    );
    const lowIndex = prices.findIndex(
      (p) => p === parseFloat(analysis.lowPrice)
    );

    // 最高點
    const highX =
      chartX + (highIndex / (analysis.priceData.length - 1)) * chartWidth;
    const highY =
      chartY +
      chartHeight -
      ((parseFloat(analysis.highPrice) - minPrice) / priceRange) * chartHeight;
    ctx.fillStyle = "#ff6b6b";
    ctx.beginPath();
    ctx.arc(highX, highY, 4, 0, 2 * Math.PI);
    ctx.fill();

    // 最低點
    const lowX =
      chartX + (lowIndex / (analysis.priceData.length - 1)) * chartWidth;
    const lowY =
      chartY +
      chartHeight -
      ((parseFloat(analysis.lowPrice) - minPrice) / priceRange) * chartHeight;
    ctx.fillStyle = "#4ecdc4";
    ctx.beginPath();
    ctx.arc(lowX, lowY, 4, 0, 2 * Math.PI);
    ctx.fill();

    // Y軸標籤 (價格)
    ctx.fillStyle = "#888888";
    ctx.font = "12px Arial";
    ctx.textAlign = "right";
    for (let i = 0; i <= 5; i++) {
      const price = minPrice + (priceRange * i) / 5;
      const y = chartY + chartHeight - (i / 5) * chartHeight;
      ctx.fillText(price.toFixed(2), chartX - 10, y + 4);

      // 網格線
      ctx.strokeStyle = "#333333";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(chartX, y);
      ctx.lineTo(chartX + chartWidth, y);
      ctx.stroke();
    }
  }

  // 畫時間軸
  if (showFullTimeAxis && analysis.priceData.length > 1) {
    ctx.fillStyle = "#cccccc";
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    const n = Math.min(6, analysis.priceData.length);
    for (let i = 0; i < n; i++) {
      const idx = Math.floor((i * (analysis.priceData.length - 1)) / (n - 1));
      const t = dayjs(analysis.priceData[idx].time).format("HH:mm");
      const x = 60 + (idx / (analysis.priceData.length - 1)) * 680;
      ctx.fillText(t, x, 455); // 往下移動，避免與統計数據重疊
    }
    ctx.textAlign = "left";
  }

  // 統計資訊
  const statsY = 490; // 往下移動，避免與時間軸重疊
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 16px Arial";
  ctx.textAlign = "left";
  ctx.fillText("統計數據", 50, statsY);

  ctx.font = "14px Arial";
  ctx.fillStyle = "#cccccc";
  const stats = [
    `起始價格: ${analysis.startPrice}`,
    `結束價格: ${analysis.endPrice}`,
    `最高價格: ${analysis.highPrice} (${analysis.highTime})`,
    `最低價格: ${analysis.lowPrice} (${analysis.lowTime})`,
    `總漲跌: ${analysis.totalChange} (${analysis.totalChangePercent}%)`,
    `平均價格: ${analysis.avgPrice}`,
    `波動幅度: ${analysis.volatility} (${analysis.volatilityPercent}%)`,
  ];

  stats.forEach((stat, index) => {
    const row = Math.floor(index / 2);
    const col = index % 2;
    const x = 50 + col * 350;
    const y = statsY + 30 + row * 20;
    ctx.fillText(stat, x, y);
  });

  return canvas.toBuffer("image/png");
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

// 處理股票消息
// 當收到股票消息時，解析並記錄所有股票資訊
// 並在睡眠追蹤時也記錄所有股票資訊
// 並自動推播符合條件的股票
// 這個函數會在每次收到新的股票消息時被調用
// 這樣可以確保每次都能正確解析並記錄股票資訊
function handleStockMessage(message) {
  if (message.channelId !== CHANNEL_ID) return;
  if (!message.embeds || message.embeds.length === 0) return;

  const embed = message.embeds[0];
  if (!embed.fields || embed.fields.length === 0) return;

  // 解析所有股票
  const stocks = [];
  for (const field of embed.fields) {
    const stock = parseStockField(field.rawValue || field.value);
    if (stock) stocks.push(stock);
  }
  if (stocks.length > 0) {
    addAllStocksToHistory(stocks);
    console.log(`📊 已記錄 ${stocks.length} 支股票資訊`);
    // 睡眠追蹤時也記錄所有股票
    addAllStocksToSleepTracking(stocks, dayjs());
    // 自動推播
    const autoNotifySymbols = getAutoNotifySymbols();
    for (const stock of stocks) {
      if (autoNotifySymbols.includes(stock.symbol)) {
        sendStockNotify(stock.symbol, message.channel);
      }
    }
  }
}

// 處理睡眠追蹤指令
async function handleSleepCommand(message) {
  //if (message.channelId !== CHANNEL_ID) return;
  if (message.author.id !== USER_ID) return;

  const content = message.content.trim();

  if (content === "&ST") {
    const sleepData = loadSleepData();

    if (!sleepData.isTracking) {
      // 開始睡眠追蹤
      startSleepTracking();
      message.reply(
        "<:emoji_23:1309461749858304090> **睡眠追蹤已開始**\n我會記錄接下來的所有股票價格數據，直到你再次輸入 `&ST`"
      );
    } else {
      // 結束睡眠追蹤並生成報告
      const trackingData = stopSleepTracking();
      if (!trackingData) {
        message.reply("❌ 沒有正在進行的睡眠追蹤");
        return;
      }

      const analyses = analyzeSleepData(trackingData);
      if (
        !Array.isArray(analyses) ||
        analyses.length === 0 ||
        analyses[0].error
      ) {
        message.reply(`❌ 沒有足夠的數據進行分析`);
        return;
      }

      try {
        // 分批發送，每批最多 5 張圖與 5 段文字
        const batchSize = 5;
        for (let i = 0; i < analyses.length; i += batchSize) {
          const batch = analyses.slice(i, i + batchSize);
          const files = [];
          let reportMessage = `<@${USER_ID}>\n\n<:emoji_23:1309461749858304090> **睡眠期間多股票分析報告**\n`;
          for (const analysis of batch) {
            const chartBuffer = await createSleepChart(analysis);
            files.push(
              new MessageAttachment(
                chartBuffer,
                `${analysis.symbol}_sleep_analysis.png`
              )
            );
            const changeEmoji =
              parseFloat(analysis.totalChange) >= 0 ? "📈" : "📉";
            const changeColor =
              parseFloat(analysis.totalChange) >= 0 ? "🟢" : "🔴";
            reportMessage += `\n**${analysis.symbol} - ${analysis.name}**\n`;
            reportMessage += `• 起始價格：\`${analysis.startPrice}\`\n`;
            reportMessage += `• 結束價格：\`${analysis.endPrice}\`\n`;
            reportMessage += `• 總漲跌額：\`${analysis.totalChange}\` ${changeEmoji}\n`;
            reportMessage += `• 總漲跌幅：\`${analysis.totalChangePercent}%\` ${changeColor}\n`;
            reportMessage += `• 最高價格：\`${analysis.highPrice}\` (${analysis.highTime})\n`;
            reportMessage += `• 最低價格：\`${analysis.lowPrice}\` (${analysis.lowTime})\n`;
            reportMessage += `• 平均價格：\`${analysis.avgPrice}\`\n`;
            reportMessage += `• 波動幅度：\`${analysis.volatility}\` (\`${analysis.volatilityPercent}%\`)\n`;
            reportMessage += `• 數據點數：\`${analysis.dataPoints}\`\n`;
            reportMessage += `━━━━━━━━━━━━━━━━━━\n`;
          }
          // 最後一批才加總結
          if (i + batchSize >= analyses.length) {
            reportMessage += `\n睡眠時間：\`${analyses[0].startTime}\` ~ \`${analyses[0].endTime}\`\n睡眠時長：\`${analyses[0].sleepDuration}\` 小時\n祝你有個好夢！ 🌙✨`;
          }
          // 若超過 2000 字，則裁切
          if (reportMessage.length > 2000) {
            reportMessage = reportMessage.slice(0, 1990) + "...";
          }
          await message.reply({ content: reportMessage, files });
        }
      } catch (error) {
        console.error("生成睡眠報告時發生錯誤:", error);
        message.reply("❌ 生成報告時發生錯誤，但數據已保存");
      }
    }
  }
}

// 查詢指定股票報告與股票列表
async function handleReportCommand(message) {
  //if (message.channelId !== CHANNEL_ID) return;
  //if (message.author.id !== USER_ID) return;
  const content = message.content.trim();
  if (!content.startsWith("&report")) return;
  const args = content.split(/\s+/);
  if (args[1] === "list") {
    // 顯示所有股票列表
    const all = loadAllStockHistory();
    const symbols = [...new Set(all.map((d) => d.symbol))];
    const names = {};
    all.forEach((d) => {
      if (!names[d.symbol]) names[d.symbol] = d.name;
    });
    let msg = `**可查詢股票列表**\n`;
    symbols.forEach((s) => {
      msg += `• ${s} - ${names[s]}\n`;
    });
    message.reply(msg);
    return;
  }
  if (args.length < 2) {
    message.reply("請指定股票代碼，如 &report APPLG 或 &report list");
    return;
  }
  const symbol = args[1].toUpperCase();
  // 從 allStockData.json 取出該股票所有資料
  const all = loadAllStockHistory();
  const data = all.filter((d) => d.symbol === symbol);
  if (data.length === 0) {
    message.reply(`查無 ${symbol} 的資料`);
    return;
  }
  // 分析該股票
  const startTime = dayjs(data[0].time);
  const endTime = dayjs(data[data.length - 1].time);
  const analysis = analyzeSleepData({
    startTime,
    endTime,
    data,
  })[0];
  const chartBuffer = await createSleepChart(analysis, true); // 傳 true 顯示完整時間軸
  const attachment = new MessageAttachment(chartBuffer, `${symbol}_report.png`);
  let report = `**${symbol} - ${analysis.name} 歷史分析報告**\n`;
  report += `• 起始價格：\`${analysis.startPrice}\`\n`;
  report += `• 結束價格：\`${analysis.endPrice}\`\n`;
  report += `• 總漲跌額：\`${analysis.totalChange}\`\n`;
  report += `• 總漲跌幅：\`${analysis.totalChangePercent}%\`\n`;
  report += `• 最高價格：\`${analysis.highPrice}\` (${analysis.highTime})\n`;
  report += `• 最低價格：\`${analysis.lowPrice}\` (${analysis.lowTime})\n`;
  report += `• 平均價格：\`${analysis.avgPrice}\`\n`;
  report += `• 波動幅度：\`${analysis.volatility}\` (\`${analysis.volatilityPercent}%\`)\n`;
  report += `• 數據點數：\`${analysis.dataPoints}\`\n`;
  report += `• 區間：\`${analysis.startTime}\` ~ \`${analysis.endTime}\``;
  await message.reply({ content: report, files: [attachment] });
}

// 主動查詢股票並切換自動推播
async function handleNoteCommand(message) {
  //if (message.channelId !== CHANNEL_ID) return;
  if (message.author.id !== USER_ID) return;
  const content = message.content.trim();
  if (!content.startsWith("&note")) return;
  const args = content.split(/\s+/);
  if (args.length < 2) {
    message.reply("請指定股票代碼，如 &note APPLG");
    return;
  }
  const symbol = args[1].toUpperCase();
  let autoNotifySymbols = getAutoNotifySymbols();
  if (autoNotifySymbols.includes(symbol)) {
    autoNotifySymbols = autoNotifySymbols.filter((s) => s !== symbol);
    setAutoNotifySymbols(autoNotifySymbols);
    message.reply(`已關閉 ${symbol} 的自動價格提醒`);
  } else {
    autoNotifySymbols.push(symbol);
    setAutoNotifySymbols(autoNotifySymbols);
    message.reply(`已開啟 ${symbol} 的自動價格提醒`);
    await sendStockNotify(symbol, message.channel);
  }
}

// 自動推播價格提醒
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
  // 通知內容（保留 emoji）
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

function triggerStockCommand(channel) {
  try {
    lastQueryTimestamp = Date.now();
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

  // 啟動时立即執行
  triggerStockCommand(channel);

  // 每5分鐘自動查價
  setInterval(() => {
    triggerStockCommand(channel);
  }, 5 * 60 * 1000);
});

client.on("messageCreate", (message) => {
  handleStockMessage(message);
  handleSleepCommand(message);
  handleReportCommand(message);
  handleNoteCommand(message);
  handleConfigCommand(message);
});

client.on("messageUpdate", (_, newMessage) => {
  handleStockMessage(newMessage);
});

client.login(TOKEN);

// 查詢目前設定
function handleConfigCommand(message) {
  //if (message.channelId !== CHANNEL_ID) return;
  if (message.author.id !== USER_ID) return;
  const content = message.content.trim();
  if (content !== "&config") return;
  const config = loadConfig();
  let msg = `**目前設定**\n`;
  msg += `• 頻道ID：\`${CHANNEL_ID}\`\n`;
  msg += `• 用戶ID：\`${USER_ID}\`\n`;
  msg += `• 自動推播清單：`;
  if (config.autoNotifySymbols && config.autoNotifySymbols.length > 0) {
    msg += config.autoNotifySymbols.map((s) => `\`${s}\``).join(", ");
  } else {
    msg += "(無)";
  }
  message.reply(msg);
}
