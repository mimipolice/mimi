const {
  loadSleepData,
  startSleepTracking,
  stopSleepTracking,
  analyzeSleepData,
  addAllStocksToSleepTracking,
} = require("./sleep");
const { loadAllStockHistory, sendStockNotify } = require("./stock");
const { createSleepChart } = require("./chart");
const {
  getAutoNotifySymbols,
  setAutoNotifySymbols,
  loadConfig,
} = require("./config");
const { MessageAttachment } = require("discord.js-selfbot-v13");
const dayjs = require("dayjs");

const USER_ID = "586502118530351114";

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
  const data = await loadAllStockHistory(symbol); // 直接查詢單一股票
  if (!Array.isArray(data)) {
    message.reply("查詢失敗，API 回傳格式錯誤");
    return;
  }
  if (data.length === 0) {
    message.reply(`查無 ${symbol} 的資料`);
    return;
  }
  const startTime = dayjs(data[0].time);
  const endTime = dayjs(data[data.length - 1].time);
  const analysis = analyzeSleepData({ startTime, endTime, data })[0];
  const chartBuffer = await createSleepChart(analysis, true);
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

module.exports = {
  handleSleepCommand,
  handleReportCommand,
  handleNoteCommand,
  handleConfigCommand,
};
