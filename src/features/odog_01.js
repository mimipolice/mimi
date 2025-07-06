const fs = require("fs");
const path = require("path");
const ODOG_STATS_PATH = path.resolve(
  __dirname,
  "../../data/json/odog_stats.json"
);

const rarityMap = {
  65535: "EX", // 青色
  16711680: "LR", // 紅色
  16729344: "UR", // 橘色
  16766720: "SSR", // 金色
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

function getLocalDateString(date = new Date(), tzOffset = 8) {
  // tzOffset: +8 for Asia/Taipei
  const local = new Date(date.getTime() + tzOffset * 60 * 60 * 1000);
  return (
    local.getUTCFullYear() +
    "-" +
    String(local.getUTCMonth() + 1).padStart(2, "0") +
    "-" +
    String(local.getUTCDate()).padStart(2, "0")
  );
}

async function handleOdogMessage(message) {
  if (
    message.channelId === "1375058548874149898" &&
    message.embeds &&
    message.embeds.length > 0
  ) {
    const embed = message.embeds[0];
    //console.log("[ODOG EMBED COLOR]", embed.color, embed.rawColor, embed.colorString);
    const rarity = rarityMap[embed.color];
    if (rarity) {
      let username = "未知";
      const title = embed.title || "";
      if (title) {
        const userMatch = title.match(/^(.+?) 抽到了/);
        if (userMatch) username = userMatch[1];
      }
      if (username === "未知" && embed.author?.name) {
        username = embed.author.name;
      }
      const date = getLocalDateString(
        new Date(message.createdTimestamp || Date.now())
      );
      const stats = loadOdogStats();
      if (!stats[date]) stats[date] = {};
      if (!stats[date][username])
        stats[date][username] = { EX: 0, LR: 0, UR: 0, SSR: 0 };
      stats[date][username][rarity]++;
      saveOdogStats(stats);
      //console.log("[ODOG統計]", date, stats[date]);
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
  while (true) {
    const options = { limit: 100 };
    if (before) options.before = before;
    const messages = await channel.messages.fetch(options);
    if (!messages.size) break;
    for (const msg of messages.values()) {
      if (!msg.embeds || msg.embeds.length === 0) continue;
      const embed = msg.embeds[0];
      const rarity = rarityMap[embed.color];
      // 加強 debug log
      console.log("[ODOG HIST]", {
        id: msg.id,
        ts: msg.createdTimestamp,
        color: embed.color,
        title: embed.title,
        description: embed.description,
        authorName: embed.author?.name,
        rarity: rarity,
      });
      if (!rarity) continue;
      let username = "未知";
      const title = embed.title || "";
      if (title) {
        const userMatch = title.match(/^(.+?) 抽到了/);
        if (userMatch) username = userMatch[1];
      }
      if (username === "未知" && embed.author?.name) {
        username = embed.author.name;
      }
      const date = getLocalDateString(
        new Date(msg.createdTimestamp || Date.now())
      );
      if (days || sinceNoon) {
        console.log(
          "sinceTs",
          sinceTs,
          "msg.createdTimestamp",
          msg.createdTimestamp,
          "diff",
          msg.createdTimestamp - sinceTs
        );
        if (msg.createdTimestamp < sinceTs) continue;
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
  // 合併到原有 stats
  console.log("[ODOG歷史統計-新統計]", stats);
  const oldStats = loadOdogStats();
  //console.log("[ODOG歷史統計-原有]", oldStats);
  for (const date in stats) {
    if (!oldStats[date]) oldStats[date] = {};
    for (const user in stats[date]) {
      if (!oldStats[date][user])
        oldStats[date][user] = { EX: 0, LR: 0, UR: 0, SSR: 0 };
      for (const r of ["EX", "LR", "UR", "SSR"]) {
        const before = oldStats[date][user][r];
        const add = stats[date][user][r];
        // 修正 NaN 問題
        if (
          typeof oldStats[date][user][r] !== "number" ||
          isNaN(oldStats[date][user][r])
        )
          oldStats[date][user][r] = 0;
        if (
          typeof stats[date][user][r] !== "number" ||
          isNaN(stats[date][user][r])
        )
          continue;
        console.log(
          `[ODOG合併] date=${date} user=${user} rarity=${r} before=${before} add=${add}`
        );
        oldStats[date][user][r] += stats[date][user][r];
      }
    }
  }
  //console.log("[ODOG歷史統計-合併後]", oldStats);
  saveOdogStats(oldStats);
  return oldStats;
}

function getStringWidth(str) {
  // 計算字符串的顯示寬度，中文字符算2個字符寬度
  let width = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    if (char >= 0x4e00 && char <= 0x9fff) {
      // 中文字符範圍
      width += 2;
    } else if (char >= 0xff00 && char <= 0xffef) {
      // 全形字符範圍
      width += 2;
    } else {
      width += 1;
    }
  }
  return width;
}

function padString(str, targetWidth, padChar = " ") {
  const currentWidth = getStringWidth(str);
  if (currentWidth >= targetWidth) {
    return str;
  }
  return str + padChar.repeat(targetWidth - currentWidth);
}

function formatRankingMessage(title, userStats, showRank = true) {
  let msg = `**${title}**\n`;
  msg += "─".repeat(40) + "\n\n";

  const users = Object.keys(userStats);
  users.sort((a, b) => {
    // 先比總計，再比稀有度順序
    const totalA =
      (userStats[a].EX || 0) +
      (userStats[a].LR || 0) +
      (userStats[a].UR || 0) +
      (userStats[a].SSR || 0);
    const totalB =
      (userStats[b].EX || 0) +
      (userStats[b].LR || 0) +
      (userStats[b].UR || 0) +
      (userStats[b].SSR || 0);
    if (totalB !== totalA) return totalB - totalA;

    for (const r of ["EX", "LR", "UR", "SSR"]) {
      if ((userStats[b][r] || 0) !== (userStats[a][r] || 0)) {
        return (userStats[b][r] || 0) - (userStats[a][r] || 0);
      }
    }
    return 0;
  });

  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    const s = userStats[user];
    const total = (s.EX || 0) + (s.LR || 0) + (s.UR || 0) + (s.SSR || 0);

    // 排名
    const rank = `${i + 1}.`.padStart(3);

    // 用戶名（限制長度並考慮中文字符寬度）
    let displayName = user;
    if (getStringWidth(user) > 16) {
      // 截斷到16個字符寬度
      let truncated = "";
      let width = 0;
      for (let i = 0; i < user.length; i++) {
        const char = user[i];
        const charWidth = getStringWidth(char);
        if (width + charWidth > 16) {
          truncated += "...";
          break;
        }
        truncated += char;
        width += charWidth;
      }
      displayName = truncated;
    }

    // 稀有度統計（格式化對齊）
    const exCount = (s.EX || 0).toString().padStart(2);
    const lrCount = (s.LR || 0).toString().padStart(2);
    const urCount = (s.UR || 0).toString().padStart(2);
    const ssrCount = (s.SSR || 0).toString().padStart(2);

    msg += `${rank} **${displayName}** | 總計: **${total}** 張\n`;
    msg += `     EX: ${exCount} | LR: ${lrCount} | UR: ${urCount} | SSR: ${ssrCount}\n`;

    if (i < users.length - 1) msg += "\n";
  }

  return msg;
}

async function handleOdogCommand(message, client) {
  // &odog 指令
  if (message.content.trim().startsWith("&odog")) {
    const stats = loadOdogStats();
    const args = message.content.trim().split(" ");
    let date = getLocalDateString(); // 以台灣時區為主
    let showAll = false;
    let showDate = date;

    if (args[1] === "all") {
      showAll = true;
    } else if (args[1] && stats[args[1]]) {
      showDate = args[1];
    }

    let msg = "";
    if (showAll) {
      // 合併所有日期
      const total = {};
      for (const d in stats) {
        for (const user in stats[d]) {
          if (!total[user]) total[user] = { EX: 0, LR: 0, UR: 0, SSR: 0 };
          for (const r of ["EX", "LR", "UR", "SSR"]) {
            total[user][r] += stats[d][user][r];
          }
        }
      }
      msg = formatRankingMessage("所有日期歐氣總排行", total);
    } else {
      if (!stats[showDate] || Object.keys(stats[showDate]).length === 0) {
        message.reply(`**${showDate}** 尚無抽卡紀錄`);
        return true;
      }
      msg = formatRankingMessage(`${showDate} 歐氣排行`, stats[showDate]);
    }
    if (msg.length > 1900) {
      const filePath = path.resolve(__dirname, "../../data/json/odog_rank.txt");
      fs.writeFileSync(filePath, msg);
      await message.reply({
        content: "排行太長，請見附件：",
        files: [filePath],
      });
      fs.unlinkSync(filePath);
    } else {
      await message.reply(msg);
    }
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
      const reply = await message.reply("開始爬取全部歷史紀錄，請稍候...");
      setTimeout(() => {
        reply.delete();
      }, 5000); //然後刪除自己
      stats = await fetchOdogHistory({
        days: null,
        sinceNoon: false,
        channel,
        client,
      });
    } else if (message.content.trim() === "&zz 1d") {
      const reply = await message.reply(
        "開始爬取今日 12:00 以後紀錄，請稍候..."
      );
      setTimeout(() => {
        reply.delete();
      }, 5000); //然後刪除自己
      stats = await fetchOdogHistory({
        days: null,
        sinceNoon: true,
        channel,
        client,
      });
    } else if (message.content.trim() === "&zz 7d") {
      const reply = await message.reply("開始爬取過去 7 天紀錄，請稍候...");
      setTimeout(() => {
        reply.delete();
      }, 5000); //然後刪除自己
      stats = await fetchOdogHistory({
        days: 7,
        sinceNoon: false,
        channel,
        client,
      });
    } else {
      const reply = await message.reply("用法：&zz、&zz 1d、&zz 7d");
      setTimeout(() => {
        reply.delete();
      }, 5000); //然後刪除自己
      return true;
    }
    const reply = await message.reply(
      "歷史紀錄更新完成！可用 &odog 查詢結果。"
    );
    setTimeout(() => {
      reply.delete();
    }, 5000); //然後刪除自己
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
