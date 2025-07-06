const {
  loadSleepData,
  startSleepTracking,
  stopSleepTracking,
  analyzeSleepData,
  addAllStocksToSleepTracking,
} = require("./sleep");
const { loadAllStockHistory, sendStockNotify } = require("./stock");
const { createSleepChart } = require("../utils/chart");
const {
  getAutoNotifySymbols,
  setAutoNotifySymbols,
  loadConfig,
} = require("../core/config");
const { MessageAttachment, WebEmbed } = require("discord.js-selfbot-v13");
const dayjs = require("dayjs");
const fs = require("fs");
const path = require("path");
const debtsPath = path.resolve(__dirname, "../../data/json/debts.json");
const { getDebtChannelId, setDebtChannelId } = require("../core/config");
const keywordsPath = path.resolve(__dirname, "../../data/json/keywords.json");

const USER_ID = "586502118530351114";

function parseTimeRange(str) {
  if (!str) return null;
  const m = str.match(/^(\d+)([dhm])$/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const unit = m[2].toLowerCase();
  if (unit === "d") return { amount: n, unit: "day" };
  if (unit === "h") return { amount: n, unit: "hour" };
  if (unit === "m") return { amount: n, unit: "month" };
  return null;
}

function loadDebts() {
  if (!fs.existsSync(debtsPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(debtsPath, "utf8"));
  } catch {
    return {};
  }
}

function saveDebts(debts) {
  fs.writeFileSync(debtsPath, JSON.stringify(debts, null, 2));
}

function loadKeywords() {
  if (!fs.existsSync(keywordsPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(keywordsPath, "utf8"));
  } catch {
    return {};
  }
}

function saveKeywords(keywords) {
  fs.writeFileSync(keywordsPath, JSON.stringify(keywords, null, 2));
}

async function handleSleepCommand(message) {
  if (message.author.id !== USER_ID) return;
  const content = message.content.trim();
  if (content === "&ST") {
    const sleepData = loadSleepData();
    if (!sleepData.isTracking) {
      startSleepTracking();
      message.reply(
        "<:emoji_23:1309461749858304090> **睡眠追蹤已開始**\n我會記錄接下來的所有股票價格數據，直到你再次輸入 `&ST`"
      );
    } else {
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
          if (i + batchSize >= analyses.length) {
            reportMessage += `\n睡眠時間：\`${analyses[0].startTime}\` ~ \`${analyses[0].endTime}\`\n睡眠時長：\`${analyses[0].sleepDuration}\` 小時\n祝你有個好夢！ 🌙✨`;
          }
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

async function handleReportCommand(message) {
  const content = message.content.trim();
  if (!content.startsWith("&report")) return;
  const args = content.split(/\s+/);
  if (args[1] === "list") {
    const all = await loadAllStockHistory();
    console.log("[DEBUG] handleReportCommand all:", all);
    // 依 symbol 分組，找出每支股票的最後一筆資料
    const latestBySymbol = {};
    all.forEach((d) => {
      if (
        !latestBySymbol[d.symbol] ||
        new Date(d.time) > new Date(latestBySymbol[d.symbol].time)
      ) {
        latestBySymbol[d.symbol] = d;
      }
    });
    const symbols = Object.keys(latestBySymbol);
    let msg = `**可查詢股票列表**\n-# 目前共有 ${symbols.length} 支股票\n`;
    symbols.forEach((s) => {
      const d = latestBySymbol[s];
      msg += `• ${s} - ${d.name}（last update：<t:${Math.floor(
        new Date(d.time).getTime() / 1000
      )}:R>）\n`;
    });
    message.reply(msg);
    return;
  }
  if (args.length < 2) {
    message.reply("請指定股票代碼，如 &report APPLG 或 &report list");
    return;
  }
  const symbol = args[1].toUpperCase();
  let data = await loadAllStockHistory(symbol); // 直接查詢單一股票
  if (!Array.isArray(data)) {
    message.reply("查詢失敗，API 回傳格式錯誤");
    return;
  }
  if (data.length === 0) {
    message.reply(`查無 ${symbol} 的資料`);
    return;
  }
  // 支援 &report love 1d 2d 7d 1m 5h ...
  let filtered = data;
  let timeRange = null;
  if (args.length >= 3) {
    // 只取最後一個合法區間參數
    for (let i = args.length - 1; i >= 2; --i) {
      const tr = parseTimeRange(args[i]);
      if (tr) {
        timeRange = tr;
        break;
      }
    }
    if (timeRange) {
      const end = dayjs(data[data.length - 1].time);
      const start = end.subtract(timeRange.amount, timeRange.unit);
      filtered = data.filter((d) => dayjs(d.time).isAfter(start));
      if (filtered.length === 0) {
        message.reply(`區間內無資料 (${args[2]})`);
        return;
      }
    }
  }
  const startTime = dayjs(filtered[0].time);
  const endTime = dayjs(filtered[filtered.length - 1].time);
  const analysis = analyzeSleepData({ startTime, endTime, data: filtered })[0];
  const chartBuffer = await createSleepChart(analysis, true);
  const attachment = new MessageAttachment(chartBuffer, `${symbol}_report.png`);
  const highUnix =
    analysis.highDateTime && analysis.highDateTime !== "-"
      ? dayjs(analysis.highDateTime, "YYYY-MM-DD HH:mm:ss").isValid()
        ? dayjs(analysis.highDateTime, "YYYY-MM-DD HH:mm:ss").unix()
        : null
      : null;
  const lowUnix =
    analysis.lowDateTime && analysis.lowDateTime !== "-"
      ? dayjs(analysis.lowDateTime, "YYYY-MM-DD HH:mm:ss").isValid()
        ? dayjs(analysis.lowDateTime, "YYYY-MM-DD HH:mm:ss").unix()
        : null
      : null;
  let report = `**${symbol} - ${
    analysis.name
  } 歷史分析報告**\n-# 最後更新：<t:${Math.floor(
    new Date(filtered[filtered.length - 1].time).getTime() / 1000
  )}:R>\n\n`;
  report += `• 起始價格：\`${analysis.startPrice}\`\n`;
  report += `• 結束價格：\`${analysis.endPrice}\`\n`;
  report += `• 總漲跌額：\`${analysis.totalChange}\`\n`;
  report += `• 總漲跌幅：\`${analysis.totalChangePercent}%\`\n`;
  report += `• 最高價格：\`${analysis.highPrice}\` (${
    highUnix ? `<t:${highUnix}:F>` : "-"
  })\n`;
  report += `• 最低價格：\`${analysis.lowPrice}\` (${
    lowUnix ? `<t:${lowUnix}:F>` : "-"
  })\n`;
  report += `• 平均價格：\`${analysis.avgPrice}\`\n`;
  report += `• 波動幅度：\`${analysis.volatility}\` (\`${analysis.volatilityPercent}%\`)\n`;
  report += `• 數據點數：\`${analysis.dataPoints}\`\n`;
  report += `• 區間：\`${analysis.startTime}\` ~ \`${analysis.endTime}\`（共 ${analysis.sleepDuration} 小時）`;
  await message.reply({ content: report, files: [attachment] });
}

async function handleNoteCommand(message) {
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

async function handleDebtCommand(message) {
  if (!message.content.trim().startsWith("&ad")) return;
  const args = message.content.trim().split(/\s+/);
  const userId = message.author.id;
  let debts = loadDebts();

  // &ad setchannel <channelId>
  if (args[1] === "setchannel" && args[2]) {
    setDebtChannelId(args[2]);
    const embed = new WebEmbed()
      .setTitle("欠款提醒頻道設定")
      .setColor("GREEN")
      .setDescription(`已設定欠款提醒頻道ID為 ${args[2]}`);
    message.reply({ content: `嗨 ${WebEmbed.hiddenEmbed}${embed}` });
    return;
  }

  // &ad <金額> [ID]
  if (args[1] && !isNaN(Number(args[1]))) {
    const amount = Number(args[1]);
    const toId = args[2] || "586502118530351114"; // 預設欠給主人
    if (!debts[userId]) debts[userId] = [];
    debts[userId].push({ to: toId, amount, timestamp: Date.now() });
    saveDebts(debts);
    let authorName = `債主ID: ${toId}`;
    let authorIcon = undefined;
    let toUsername = toId;
    try {
      const user = await message.client.users.fetch(toId);
      if (user) {
        authorName = user.username;
        authorIcon = user.avatarURL
          ? user.avatarURL()
          : user.displayAvatarURL();
        toUsername = user.username;
      }
    } catch {}
    const embed = new WebEmbed()
      .setTitle("欠款紀錄新增")
      .setColor("ORANGE")
      .setAuthor({ name: authorName, iconURL: authorIcon })
      .setDescription(`已記錄你欠 ${toUsername} ${amount} 元`);
    message.reply({ content: `嗨 ${WebEmbed.hiddenEmbed}${embed}` });
    return;
  }

  // &ad 查詢
  if (!debts[userId] || debts[userId].length === 0) {
    const embed = new WebEmbed()
      .setTitle("欠款查詢")
      .setColor("BLUE")
      .setDescription("你目前沒有欠款紀錄");
    message.reply({ content: `嗨 ${WebEmbed.hiddenEmbed}${embed}` });
    return;
  }
  // 合併同債主金額
  const sumByTo = {};
  for (const d of debts[userId]) {
    if (!sumByTo[d.to]) sumByTo[d.to] = 0;
    sumByTo[d.to] += d.amount;
  }
  // 取得所有債主名稱
  const toIds = Object.keys(sumByTo);
  const nameMap = {};
  for (const toId of toIds) {
    try {
      const user = await message.client.users.fetch(toId);
      if (user && user.username) {
        nameMap[toId] = `${user.username}（${toId}）`;
      } else {
        nameMap[toId] = `${toId}（無法取得名稱）`;
      }
    } catch {
      nameMap[toId] = `${toId}（無法取得名稱）`;
    }
  }
  // 組合顯示內容
  let desc = "";
  let total = 0;
  for (const toId of toIds) {
    const amount = sumByTo[toId];
    total += amount;
    const name = nameMap[toId];
    const sign = amount > 0 ? "你欠" : "對方欠你";
    const color = amount > 0 ? "🔴" : "🟢";
    desc += `${color} ${name}：${
      amount > 0 ? "+" : ""
    }${amount} 元（${sign}）\n`;
  }
  desc += `\n總計：${total > 0 ? "+" : ""}${total} 元`;
  // 取第一個債主作為 author
  const firstToId = toIds[0];
  let authorName = nameMap[firstToId] || firstToId;
  let authorIcon = undefined;
  try {
    const user = await message.client.users.fetch(firstToId);
    if (user) {
      authorIcon = user.avatarURL ? user.avatarURL() : user.displayAvatarURL();
    }
  } catch {}
  const embed = new WebEmbed()
    .setTitle("欠款查詢")
    .setColor("BLUE")
    .setAuthor({ name: authorName, iconURL: authorIcon })
    .setDescription(desc);
  message.reply({ content: `嗨 ${WebEmbed.hiddenEmbed}${embed}` });
}

function handleConfigCommand(message) {
  if (message.author.id !== USER_ID) return;
  const content = message.content.trim();
  if (content !== "&config") return;
  const config = loadConfig();
  let msg = `**目前設定**\n`;
  msg += `• 頻道ID：\`1390554923862720572\`\n`;
  msg += `• 用戶ID：\`586502118530351114\`\n`;
  msg += `• 自動推播清單：`;
  if (config.autoNotifySymbols && config.autoNotifySymbols.length > 0) {
    msg += config.autoNotifySymbols.map((s) => `\`${s}\``).join(", ");
  } else {
    msg += "(無)";
  }
  message.reply(msg);
}

async function handleKeywordCommand(message) {
  const content = message.content.trim();
  if (content.startsWith("&addkw ")) {
    const match = content.match(/^&addkw\s+(\S+)\s+([\s\S]+)/);
    if (!match) {
      message.reply("格式錯誤，請用 &addkw 關鍵字 回覆內容");
      return;
    }
    const [, keyword, reply] = match;
    const keywords = loadKeywords();
    keywords[keyword] = reply;
    saveKeywords(keywords);
    message.reply(`已新增關鍵字：${keyword}`);
    return;
  }
  if (content.startsWith("&delkw ")) {
    const match = content.match(/^&delkw\s+(\S+)/);
    if (!match) {
      message.reply("格式錯誤，請用 &delkw 關鍵字");
      return;
    }
    const [, keyword] = match;
    const keywords = loadKeywords();
    if (keywords[keyword]) {
      delete keywords[keyword];
      saveKeywords(keywords);
      message.reply(`已刪除關鍵字：${keyword}`);
    } else {
      message.reply(`找不到關鍵字：${keyword}`);
    }
    return;
  }
  if (content === "&listkw") {
    const keywords = loadKeywords();
    if (Object.keys(keywords).length === 0) {
      message.reply("目前沒有設定任何關鍵字");
      return;
    }
    let msg = "**已設定關鍵字：**\n";
    for (const k in keywords) {
      msg += `• ${k} → ${keywords[k]}\n`;
    }
    message.reply(msg);
    return;
  }
}

module.exports = {
  handleSleepCommand,
  handleReportCommand,
  handleNoteCommand,
  handleConfigCommand,
  handleDebtCommand,
  handleKeywordCommand,
};
