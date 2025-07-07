const { analyzeSleepData } = require("./sleep");
const { loadAllStockHistory, sendStockNotify } = require("./stock");
const { createSleepChart } = require("../utils/chart");
const { MessageAttachment, WebEmbed } = require("discord.js-selfbot-v13");
const dayjs = require("dayjs");
const fs = require("fs");
const path = require("path");
const keywordsPath = path.resolve(__dirname, "../../data/json/keywords.json");

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

async function handleReportCommand(message) {
  const content = message.content.trim();
  if (!content.startsWith("&report")) return;
  const args = content.split(/\s+/);
  if (args[1] === "list") {
    const all = await loadAllStockHistory();
    //console.log("[DEBUG] handleReportCommand all:", all);
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
      msg += `> \`${s}\` - ${d.name}（last update：<t:${Math.floor(
        new Date(d.time).getTime() / 1000
      )}:R>）\n`;
    });
    msg += `\n-# 若更新時間大於\`5\`分鐘可能是米米機器人出現了問題 請隨時關注最新公告`;
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
      message.reply(`已刪除關鍵字：${keyword}\n-# by <@${message.author.id}>`);
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
      msg += `• ${k} → ${keywords[k]}\n-# by <@${message.author.id}>`;
    }
    message.reply(msg);
    return;
  }
}

async function handleHelpCommand(message) {
  const content = message.content.trim();
  const args = content.split(/\s+/);

  // 指令總覽
  if (args.length === 1) {
    let msg = "**可用指令列表**\n-# []選填 <>必填\n";
    msg += "> `&help <指令>`：顯示該指令詳細說明\n";
    msg += "> `&report <股票代碼> [區間]`：查詢股票歷史分析\n";
    msg += "> `&odog [日期|all]`：查詢歐氣排行\n";
    msg += "> `&zz [1d|7d]`：爬取歐氣歷史紀錄\n";
    msg += "> `&addkw <關鍵字> <回覆>`：新增自動回覆\n";
    msg += "> `&listkw`：列出所有關鍵字\n";
    msg += "> `&ar`：顯示當前設定\n";
    msg += "> `&ar <emoji> <channel>`：新增設定\n";
    msg += "> `&ar remove <channelId>`：移除設定\n";
    msg += "\n輸入 `&help <指令>` 來查看詳細用法，例如 `&help report`";
    await message.reply(msg);
    return;
  }

  // 細則說明
  const sub = args[1].toLowerCase();
  let detail = "";
  if (sub === "report") {
    detail = "**&report <股票代碼> [區間]**\n";
    detail += "查詢指定股票的歷史分析報告。\n";
    detail += "範例：\n";
    detail += "> `&report APPLG`（查詢全部歷史）\n";
    detail += "> `&report APPLG 1d`（查詢近一天）\n";
    detail += "> `&report APPLG 7d`（查詢近七天）\n";
    detail += "> `&report list`（顯示可查詢股票列表）\n";
    detail += "\n區間參數支援：`1d`、`7d`、`1m`、`5h` ...";
  } else if (sub === "odog") {
    detail = "**&odog [日期|all]**\n";
    detail += "查詢歐氣排行。\n";
    detail += "> `&odog`：查詢今日排行\n";
    detail += "> `&odog all`：查詢總排行\n";
    detail += "> `&odog YYYY-MM-DD`：查詢指定日期排行";
  } else if (sub === "zz") {
    detail = "**&zz [1d|7d]**\n";
    detail += "爬取歐氣歷史紀錄。\n";
    detail += "> `&zz`：全部\n";
    detail += "> `&zz 1d`：今日 12:00 以後 `壞了`\n";
    detail += "> `&zz 7d`：過去 7 天 `不知道有沒有壞`";
  } else if (sub === "addkw") {
    detail = "**&addkw <關鍵字> <回覆>**\n新增自動回覆。";
  } else if (sub === "listkw") {
    detail = "**&listkw**\n列出所有關鍵字。";
  } else if (sub === "ar") {
    detail = "**&ar**\n顯示當前設定。\n";
    detail += "> `&ar <emoji> <channel>`：新增設定\n";
    detail += "> `&ar remove <channelId>`：移除設定\n";
    detail += "\n支援格式：\n";
    detail += "> `<:emoji:emojiId> <channelId>`\n";
    detail += "> `<:emoji:emojiId> <#channelId>`\n";
    detail += "> `emojiId <#channelId>`";
  } else {
    detail = "查無此指令，請輸入 `&help` 查看所有指令。";
  }
  await message.reply(detail);
}

module.exports = {
  handleReportCommand,
  handleKeywordCommand,
  handleHelpCommand,
};
