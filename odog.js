const fs = require("fs");
const path = require("path");
const ODOG_STATS_PATH = path.resolve(__dirname, "odog_stats.json");
const rarityMap = {
  "hsla(180": "EX",
  "hsla(0": "LR",
  "hsla(16": "UR",
  "hsla(51": "SSR",
};
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
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function handleOdogMessage(message) {
  if (
    message.channelId === "1375058548874149898" &&
    message.embeds &&
    message.embeds.length > 0
  ) {
    const embed = message.embeds[0];
    const colorStr = embed.color || embed.rawColor || embed.colorString;
    let rarity = null;
    for (const k in rarityMap) {
      if (colorStr && colorStr.startsWith(k)) {
        rarity = rarityMap[k];
        break;
      }
    }
    if (rarity) {
      let username = "未知";
      if (embed.rawTitle) {
        const userMatch = embed.rawTitle.match(/^(.+?) 抽到了/);
        if (userMatch) username = userMatch[1];
      }
      const date = new Date(message.createdTimestamp || Date.now())
        .toISOString()
        .slice(0, 10);
      const stats = loadOdogStats();
      if (!stats[date]) stats[date] = {};
      if (!stats[date][username])
        stats[date][username] = { EX: 0, LR: 0, UR: 0, SSR: 0 };
      stats[date][username][rarity]++;
      saveOdogStats(stats);
      console.log("[ODOG統計]", date, stats[date]);
    }
  }
}

async function fetchOdogHistory({
  days = null,
  sinceNoon = false,
  channel,
  client,
}) {
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
    await sleep(500);
  }
  saveOdogStats(stats);
  console.log("[ODOG歷史統計]", stats);
  return stats;
}

async function handleOdogCommand(message, client) {
  // &odog 指令
  if (message.content.trim() === "&odog") {
    const stats = loadOdogStats();
    const date = new Date().toISOString().slice(0, 10);
    if (!stats[date] || Object.keys(stats[date]).length === 0) {
      message.reply("今日尚無抽卡紀錄");
      return true;
    }
    let msg = `**${date} 歐氣排行**\n`;
    const users = Object.keys(stats[date]);
    users.sort((a, b) => {
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
    return true;
  }
  // &zz 指令
  if (message.content.trim().startsWith("&zz")) {
    let stats;
    const channel = client.channels.cache.get("1375058548874149898");
    if (!channel) {
      message.reply("找不到目標頻道");
      return true;
    }
    if (message.content.trim() === "&zz") {
      await message.reply("開始爬取全部歷史紀錄，請稍候...");
      stats = await fetchOdogHistory({
        days: null,
        sinceNoon: false,
        channel,
        client,
      });
    } else if (message.content.trim() === "&zz 1d") {
      await message.reply("開始爬取今日 12:00 以後紀錄，請稍候...");
      stats = await fetchOdogHistory({
        days: null,
        sinceNoon: true,
        channel,
        client,
      });
    } else if (message.content.trim() === "&zz 7d") {
      await message.reply("開始爬取過去 7 天紀錄，請稍候...");
      stats = await fetchOdogHistory({
        days: 7,
        sinceNoon: false,
        channel,
        client,
      });
    } else {
      await message.reply("用法：&zz、&zz 1d、&zz 7d");
      return true;
    }
    await message.reply("歷史紀錄統計完成！可用 &odog 查詢結果。");
    return true;
  }
  return false;
}

module.exports = {
  handleOdogMessage,
  handleOdogCommand,
  fetchOdogHistory,
  loadOdogStats,
  saveOdogStats,
};
