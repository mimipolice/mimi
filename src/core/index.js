const { Client } = require("discord.js-selfbot-v13");
require("dotenv").config();
const {
  handleSleepCommand,
  handleReportCommand,
  handleNoteCommand,
  handleConfigCommand,
  handleDebtCommand,
  handleKeywordCommand,
} = require("../features/commands");
const { handleStockMessage } = require("../features/stock");
const { getDebtChannelId } = require("./config");
const fs = require("fs");
const path = require("path");
const { MessageEmbed } = require("discord.js-selfbot-v13");
const { WebEmbed } = require("discord.js-selfbot-v13");
const { handleOdogMessage, handleOdogCommand } = require("../features/odog");
const {
  handleAutoReactCommand,
  handleAutoReactMessage,
} = require("../features/autoReact");
const { logStockStatus, logDirect } = require("../utils/logger");

const client = new Client();

const CHANNEL_ID = "1390554923862720572"; // 更換為你的頻道 ID
const TOKEN = process.env.TOKEN;
let lastQueryTimestamp = 0;

const ODOG_STATS_PATH = path.resolve(
  __dirname,
  "../../data/json/odog_stats.json"
);
function loadOdogStats() {
  if (!fs.existsSync(ODOG_STATS_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(ODOG_STATS_PATH, "utf8"));
  } catch {
    return {};
  }
}
function saveOdogStats(stats) {
  fs.writeFileSync(ODOG_STATS_PATH, JSON.stringify(stats, null, 2));
}
const rarityMap = {
  "hsla(180": "EX",
  "hsla(0": "LR",
  "hsla(16": "UR",
  "hsla(51": "SSR",
};

function loadDebts() {
  const debtsPath = path.resolve(__dirname, "../../data/json/debts.json");
  if (!fs.existsSync(debtsPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(debtsPath, "utf8"));
  } catch {
    return {};
  }
}

function triggerStockCommand(channel) {
  try {
    lastQueryTimestamp = Date.now();
    channel.sendSlash("1221230734602141727", "stock");
    logStockStatus("send", "📤 已發送 /stock 指令");
  } catch (err) {
    logDirect(`❌ /stock 指令發送失敗: ${err}`);
  }
}

// 每天12:00自動提醒欠款
function scheduleDebtReminder(client) {
  async function sendDebtReminders() {
    const debts = loadDebts();
    const channelId = getDebtChannelId();
    const channel = client.channels.cache.get(channelId);
    if (!channel) return;
    let hasDebt = false;
    for (const userId in debts) {
      if (!debts[userId] || debts[userId].length === 0) continue;
      hasDebt = true;
      let total = 0;
      let desc = "";
      for (const [i, d] of debts[userId].entries()) {
        desc += `${i + 1}. 欠 <@${d.to}> ${d.amount} 元\n`;
        total += d.amount;
      }
      desc += `\n總計：${total} 元`;
      // 取第一筆債主資訊
      const firstDebt = debts[userId][0];
      let authorName = `債主ID: ${firstDebt.to}`;
      let authorIcon = undefined;
      try {
        const user = await client.users.fetch(firstDebt.to);
        if (user) {
          authorName = user.username;
          authorIcon = user.displayAvatarURL();
        }
      } catch {}
      const embed = new WebEmbed()
        .setTitle("欠款提醒")
        .setColor("RED")
        .setAuthor({ name: authorName, iconURL: authorIcon })
        .setDescription(desc);
      await channel.send({ content: `${WebEmbed.hiddenEmbed}${embed}` });
    }
    if (!hasDebt) {
      channel.send({ content: "目前沒有人有欠款紀錄！" });
    }
  }
  // 計算距離下次12:00的毫秒數
  function getNextNoonDelay() {
    const now = new Date();
    const next = new Date();
    next.setHours(12, 0, 0, 0);
    if (now > next) next.setDate(next.getDate() + 1);
    return next - now;
  }
  setTimeout(function loop() {
    sendDebtReminders();
    setTimeout(loop, 24 * 60 * 60 * 1000);
  }, getNextNoonDelay());
}

const keywordsPath = path.resolve(__dirname, "../../data/json/keywords.json");
function loadKeywords() {
  if (!fs.existsSync(keywordsPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(keywordsPath, "utf8"));
  } catch {
    return {};
  }
}

client.on("ready", () => {
  console.log(`✅ Bot 已上線: ${client.user.tag}`);

  const channel = client.channels.cache.get(CHANNEL_ID);
  if (!channel) return console.error("⚠️ 找不到頻道");

  // 啟動时立即執行
  triggerStockCommand(channel);

  // 每5分鐘自動查價與推播新聞
  setInterval(() => {
    triggerStockCommand(channel);
  }, 5 * 60 * 1000);

  // 啟動欠款提醒排程
  scheduleDebtReminder(client);
});

const isKeywordMatch = (content, keyword) => {
  // 僅比對完整詞彙，避免 &addkw 觸發 &ad
  // 1. 完全等於
  if (content === keyword) return true;
  // 2. 用非字元分隔（空白、標點、行首行尾）
  const pattern = new RegExp(
    `(^|\s|[.,!?;:，。！？；：])${keyword}($|\s|[.,!?;:，。！？；：])`
  );
  return pattern.test(content);
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchChannelHistory({
  days = null,
  sinceNoon = false,
  channelId = "1375058548874149898",
}) {
  const channel = client.channels.cache.get(channelId);
  if (!channel) return;
  let before = undefined;
  let done = false;
  const now = new Date();
  let sinceTs = 0;
  if (days) {
    sinceTs = now.getTime() - days * 24 * 60 * 60 * 1000;
  }
  if (sinceNoon) {
    const noon = new Date(now);
    noon.setHours(12, 0, 0, 0);
    sinceTs = noon.getTime();
  }
  const stats = {};
  while (!done) {
    const options = { limit: 100 };
    if (before) options.before = before;
    const messages = await channel.messages.fetch(options);
    if (!messages.size) break;
    for (const msg of messages.values()) {
      if (!msg.embeds || msg.embeds.length === 0) continue;
      const embed = msg.embeds[0];
      const colorStr = embed.color || embed.rawColor || embed.colorString;
      let rarity = null;
      for (const k in rarityMap) {
        if (colorStr && colorStr.startsWith(k)) {
          rarity = rarityMap[k];
          break;
        }
      }
      if (!rarity) continue;
      let username = "未知";
      if (embed.rawTitle) {
        const userMatch = embed.rawTitle.match(/^(.+?) 抽到了/);
        if (userMatch) username = userMatch[1];
      }
      const date = new Date(msg.createdTimestamp || Date.now())
        .toISOString()
        .slice(0, 10);
      if (days || sinceNoon) {
        if (msg.createdTimestamp < sinceTs) {
          done = true;
          break;
        }
      }
      if (!stats[date]) stats[date] = {};
      if (!stats[date][username])
        stats[date][username] = { EX: 0, LR: 0, UR: 0, SSR: 0 };
      stats[date][username][rarity]++;
    }
    before = messages.last().id;
    if (messages.size < 100) break;
    await sleep(500); // 防止 API 過載
  }
  saveOdogStats(stats);
  console.log("[ODOG歷史統計]", stats);
  return stats;
}

client.on("messageCreate", async (message) => {
  await handleOdogMessage(message);
  if (await handleOdogCommand(message, client)) return;

  // 處理自動回應指令和訊息
  if (await handleAutoReactCommand(message, client)) return;
  await handleAutoReactMessage(message, client);

  handleStockMessage(message);
  handleSleepCommand(message);
  handleReportCommand(message);
  handleNoteCommand(message);
  handleConfigCommand(message);
  handleDebtCommand(message);
  handleKeywordCommand(message);
  // &odog 指令
  if (message.content.trim() === "&odog") {
    const stats = loadOdogStats();
    const date = new Date().toISOString().slice(0, 10);
    if (!stats[date] || Object.keys(stats[date]).length === 0) {
      message.reply("今日尚無抽卡紀錄");
      return;
    }
    // 排行
    let msg = `**${date} 歐氣排行**\n`;
    const users = Object.keys(stats[date]);
    users.sort((a, b) => {
      // 先比EX，再LR，再UR，再SSR
      for (const r of ["EX", "LR", "UR", "SSR"]) {
        if ((stats[date][b][r] || 0) !== (stats[date][a][r] || 0)) {
          return (stats[date][b][r] || 0) - (stats[date][a][r] || 0);
        }
      }
      return 0;
    });
    for (const user of users) {
      const s = stats[date][user];
      msg += `• ${user}：EX:${s.EX} LR:${s.LR} UR:${s.UR} SSR:${s.SSR}\n`;
    }
    message.reply(msg);
    return;
  }
  // &zz 指令觸發爬蟲
  if (message.content.trim().startsWith("&zz")) {
    let stats;
    if (message.content.trim() === "&zz") {
      await message.reply("開始爬取全部歷史紀錄，請稍候...");
      stats = await fetchChannelHistory({ days: null, sinceNoon: false });
    } else if (message.content.trim() === "&zz 1d") {
      await message.reply("開始爬取今日 12:00 以後紀錄，請稍候...");
      stats = await fetchChannelHistory({ days: null, sinceNoon: true });
    } else if (message.content.trim() === "&zz 7d") {
      await message.reply("開始爬取過去 7 天紀錄，請稍候...");
      stats = await fetchChannelHistory({ days: 7, sinceNoon: false });
    } else {
      await message.reply("用法：&zz、&zz 1d、&zz 7d");
      return;
    }
    await message.reply("歷史紀錄統計完成！可用 &odog 查詢結果。");
    return;
  }
  if (message.author.bot || message.author.id === client.user.id) return;
  if (message.content.trim().startsWith("&")) return; // 指令不觸發
  const keywords = loadKeywords();
  for (const k in keywords) {
    if (isKeywordMatch(message.content, k)) {
      message.reply(keywords[k]);
      break;
    }
  }
});

client.on("messageUpdate", (_, newMessage) => {
  handleStockMessage(newMessage);
});

client.login(TOKEN);
