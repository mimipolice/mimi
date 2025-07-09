const { analyzeSleepData } = require("./sleep");
const { loadAllStockHistory } = require("./stock");
const { createSleepChart } = require("../utils/chart");
const { MessageAttachment } = require("discord.js-selfbot-v13");
const dayjs = require("dayjs");

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

async function Report(message) {
  const content = message.content.trim();
  if (!/^&(report|r)(\s|$)/.test(content)) return;
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
  if (args[1] === "all") {
    const all = await loadAllStockHistory();
    // 依 symbol 分組
    const bySymbol = {};
    all.forEach((d) => {
      if (!bySymbol[d.symbol]) bySymbol[d.symbol] = [];
      bySymbol[d.symbol].push(d);
    });
    const symbols = Object.keys(bySymbol);
    // 產生每支股票的總和報告與圖表
    const reportsWithImages = [];
    for (const s of symbols) {
      const arr = bySymbol[s];
      arr.sort((a, b) => new Date(a.time) - new Date(b.time));
      const name = arr[0]?.name || s;
      // 取價格陣列，型別安全
      const prices = arr.map((d) => Number(d.price)).filter((v) => !isNaN(v));
      const high = prices.length ? Math.max(...prices) : "-";
      const low = prices.length ? Math.min(...prices) : "-";
      const avg = prices.length
        ? (prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2)
        : "-";
      const totalChange = prices.length
        ? (prices[prices.length - 1] - prices[0]).toFixed(2)
        : "-";
      const totalChangePercent =
        prices.length && prices[0] !== 0
          ? (
              ((prices[prices.length - 1] - prices[0]) / prices[0]) *
              100
            ).toFixed(2)
          : "-";
      const startPrice = prices.length ? prices[0] : "-";
      const endPrice = prices.length ? prices[prices.length - 1] : "-";
      const start = arr[0];
      const end = arr[arr.length - 1];
      // 統計分析資料
      const startTime = start.time;
      const endTime = end.time;
      const analysis = analyzeSleepData({
        startTime: dayjs(startTime),
        endTime: dayjs(endTime),
        data: arr,
      })[0];
      const chartBuffer = await createSleepChart(analysis, true);
      const attachment = new MessageAttachment(chartBuffer, `${s}_report.png`);
      const report = `\`${s}\` - ${name}\n資料點數: \`${
        arr.length
      }\`\n起始: \`${startPrice}\` 結束: \`${endPrice}\`\n最高: \`${high}\` 最低: \`${low}\` 平均: \`${avg}\`\n總漲跌: \`${totalChange}\` (${totalChangePercent}%)\n最後更新：<t:${Math.floor(
        new Date(end.time).getTime() / 1000
      )}:R>`;
      reportsWithImages.push({ report, attachment });
    }
    // 每五則發送一則訊息
    for (let i = 0; i < reportsWithImages.length; i += 5) {
      const chunk = reportsWithImages.slice(i, i + 5);
      const content =
        `**所有股票歷史總和**\n` + chunk.map((x) => x.report).join("\n\n");
      const files = chunk.map((x) => x.attachment);
      // eslint-disable-next-line no-await-in-loop
      await message.reply({ content, files });
    }
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

module.exports = {
  Report,
};
