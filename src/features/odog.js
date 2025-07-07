const fs = require("fs");
const path = require("path");
const { createCanvas, loadImage } = require("canvas");

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

const rarityColors = {
  EX: "#0099FF", // 青色
  LR: "#FF0000", // 紅色
  UR: "#FF9900", // 橘色
  SSR: "#FFD700", // 金色
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

function getStringWidth(ctx, str) {
  // 計算字符串的顯示寬度，考慮中文字符
  let width = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    if (char >= 0x4e00 && char <= 0x9fff) {
      // 中文字符範圍
      width += ctx.measureText("中").width;
    } else if (char >= 0xff00 && char <= 0xffef) {
      // 全形字符範圍
      width += ctx.measureText("Ａ").width;
    } else {
      width += ctx.measureText(str[i]).width;
    }
  }
  return width;
}

function truncateText(ctx, text, maxWidth) {
  if (getStringWidth(ctx, text) <= maxWidth) {
    return text;
  }

  let truncated = "";
  let width = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const charWidth = ctx.measureText(char).width;
    if (width + charWidth + ctx.measureText("...").width > maxWidth) {
      truncated += "...";
      break;
    }
    truncated += char;
    width += charWidth;
  }
  return truncated;
}

function generateRankingCanvas(userStats, title = "歐狗榜", fontSize = 18) {
  const users = Object.keys(userStats);
  users.sort((a, b) => {
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

  const headerHeight = 120;
  const rowHeight = fontSize * 2.8;
  const canvasWidth = Math.max(800, users.length > 5 ? 1000 : 800);
  const canvasHeight = headerHeight + (users.length + 2) * rowHeight + 80;

  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext("2d");

  // 🌑 Dark background
  ctx.fillStyle = "#1e1e2f";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  ctx.font = `${fontSize}px 'Microsoft JhengHei', 'PingFang SC', 'Hiragino Sans GB', sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  // 🎯 Title
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${fontSize + 8}px sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText(title, canvasWidth / 2, 50);

  // 📆 Subtitle
  ctx.fillStyle = "#cccccc";
  ctx.font = `${fontSize - 2}px sans-serif`;
  ctx.fillText(`共 ${users.length} 名參與者`, canvasWidth / 2, 80);

  // Reset font
  ctx.font = `${fontSize}px 'Consolas', 'Monaco', monospace`;
  ctx.textAlign = "left";

  const rankWidth = 80;
  const nameWidth = Math.max(200, canvasWidth * 0.25);
  const rarityWidth = 70;
  const totalWidth = 80;
  const startX = 40;
  let currentY = headerHeight;

  const colX = {
    rank: startX + rankWidth / 2,
    name: startX + rankWidth + 10,
    EX: startX + rankWidth + nameWidth + rarityWidth * 0 + rarityWidth / 2,
    LR: startX + rankWidth + nameWidth + rarityWidth * 1 + rarityWidth / 2,
    UR: startX + rankWidth + nameWidth + rarityWidth * 2 + rarityWidth / 2,
    SSR: startX + rankWidth + nameWidth + rarityWidth * 3 + rarityWidth / 2,
    total: startX + rankWidth + nameWidth + rarityWidth * 4 + totalWidth / 2,
  };

  // 🟪 Table Header
  ctx.fillStyle = "#2c2c3a";
  ctx.fillRect(
    startX - 10,
    currentY - rowHeight / 2,
    rankWidth + nameWidth + rarityWidth * 4 + totalWidth + 20,
    rowHeight
  );

  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("排名", colX.rank, currentY);
  ctx.textAlign = "left";
  ctx.fillText("使用者", colX.name, currentY);
  ctx.textAlign = "center";
  ctx.fillText("EX", colX.EX, currentY);
  ctx.fillText("LR", colX.LR, currentY);
  ctx.fillText("UR", colX.UR, currentY);
  ctx.fillText("SSR", colX.SSR, currentY);
  ctx.fillText("總計", colX.total, currentY);

  currentY += rowHeight;

  users.forEach((user, index) => {
    const stats = userStats[user];
    const total =
      (stats.EX || 0) + (stats.LR || 0) + (stats.UR || 0) + (stats.SSR || 0);

    // 行背景色
    ctx.fillStyle = index % 2 === 0 ? "#2c2c3a" : "#1e1e2f";
    ctx.fillRect(
      startX - 10,
      currentY - rowHeight / 2,
      rankWidth + nameWidth + rarityWidth * 4 + totalWidth + 20,
      rowHeight
    );

    let rankColor = "#ffffff";
    let showCrown = false;
    if (index === 0) {
      rankColor = "#e74c3c";
      showCrown = true;
    } else if (index === 1) {
      rankColor = "#f39c12";
    } else if (index === 2) {
      rankColor = "#f1c40f";
    }

    // 排名
    ctx.fillStyle = rankColor;
    ctx.font = `bold ${fontSize + 2}px sans-serif`;
    ctx.textAlign = "center";
    const rankText = showCrown ? `👑${index + 1}` : `${index + 1}`;
    ctx.fillText(rankText, colX.rank, currentY);

    // 名稱
    ctx.fillStyle = "#eeeeee";
    ctx.font = `${fontSize}px sans-serif`;
    ctx.textAlign = "left";
    const truncatedName = truncateText(ctx, user, nameWidth - 20);
    ctx.fillText(truncatedName, colX.name, currentY);

    // 稀有度數值
    ctx.textAlign = "center";
    const rarities = ["EX", "LR", "UR", "SSR"];
    rarities.forEach((rarity) => {
      const count = stats[rarity] || 0;
      const x = colX[rarity];

      if (count > 0) {
        ctx.fillStyle = rarityColors[rarity];
        ctx.font = `bold ${fontSize}px monospace`;
      } else {
        ctx.fillStyle = "#555";
        ctx.font = `${fontSize}px monospace`;
      }
      ctx.fillText(count.toString(), x, currentY);
    });

    // 總計
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${fontSize + 2}px monospace`;
    ctx.fillText(total.toString(), colX.total, currentY);

    currentY += rowHeight;
  });

  // 邊框
  ctx.strokeStyle = "#444";
  ctx.lineWidth = 2;
  ctx.strokeRect(
    startX - 10,
    headerHeight - rowHeight / 2,
    rankWidth + nameWidth + rarityWidth * 4 + totalWidth + 20,
    currentY - headerHeight + rowHeight / 2
  );

  // 分隔線
  const lines = [
    startX + rankWidth,
    startX + rankWidth + nameWidth,
    ...[1, 2, 3, 4].map(
      (i) => startX + rankWidth + nameWidth + rarityWidth * i
    ),
  ];
  ctx.strokeStyle = "#444";
  ctx.lineWidth = 1;
  lines.forEach((x) => {
    ctx.beginPath();
    ctx.moveTo(x, headerHeight - rowHeight / 2);
    ctx.lineTo(x, currentY - rowHeight / 2);
    ctx.stroke();
  });

  // 圖例
  const legendY = currentY + 20;
  ctx.fillStyle = "#cccccc";
  ctx.font = `${fontSize - 2}px sans-serif`;
  ctx.textAlign = "left";
  ctx.fillText("稀有度說明：", startX, legendY);

  let legendX = startX + 100;
  Object.entries(rarityColors).forEach(([rarity, color]) => {
    ctx.fillStyle = color;
    ctx.fillRect(legendX, legendY - 8, 15, 16);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(rarity, legendX + 20, legendY);
    legendX += 80;
  });

  // 時間戳
  ctx.fillStyle = "#888";
  ctx.font = `${fontSize - 4}px sans-serif`;
  ctx.textAlign = "right";
  ctx.fillText(
    `生成時間: ${getLocalDateString()} ${new Date().toLocaleTimeString(
      "zh-TW"
    )}`,
    canvasWidth - 20,
    canvasHeight - 20
  );

  return canvas;
}

async function handleOdogMessage(message) {
  if (
    message.channelId === "1375058548874149898" &&
    message.embeds &&
    message.embeds.length > 0
  ) {
    const embed = message.embeds[0];
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
      // console.log("[ODOG HIST]", {
      //   id: msg.id,
      //   ts: msg.createdTimestamp,
      //   color: embed.color,
      //   title: embed.title,
      //   description: embed.description,
      //   authorName: embed.author?.name,
      //   rarity: rarity,
      // });
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
  //console.log("[ODOG歷史統計-新統計] (覆寫)", stats); //debug console
  saveOdogStats(stats);
  return stats;
}

async function handleOdogCommand(message, client) {
  // &odog 指令
  if (message.content.trim().startsWith("&odog")) {
    const stats = loadOdogStats();
    const args = message.content.trim().split(" ");
    let date = getLocalDateString();
    let showAll = false;
    let showDate = date;

    if (args[1] === "all") {
      showAll = true;
    } else if (args[1] && stats[args[1]]) {
      showDate = args[1];
    }

    let userStats = {};
    let title = "";

    if (showAll) {
      // 合併所有日期
      for (const d in stats) {
        for (const user in stats[d]) {
          if (!userStats[user])
            userStats[user] = { EX: 0, LR: 0, UR: 0, SSR: 0 };
          for (const r of ["EX", "LR", "UR", "SSR"]) {
            userStats[user][r] += stats[d][user][r];
          }
        }
      }
      title = "所有日期歐狗榜";
    } else {
      if (!stats[showDate] || Object.keys(stats[showDate]).length === 0) {
        message.reply(`**${showDate}** 尚無抽卡紀錄`);
        return true;
      }
      userStats = stats[showDate];
      title = `${showDate} 歐狗榜`;
    }

    try {
      // 生成Canvas圖表
      const canvas = generateRankingCanvas(userStats, title);
      const buffer = canvas.toBuffer("image/png");

      // 保存臨時文件
      const tempPath = path.resolve(
        __dirname,
        "../../data/temp/odog_ranking.png"
      );

      // 確保目錄存在
      const tempDir = path.dirname(tempPath);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      fs.writeFileSync(tempPath, buffer);

      await message.reply({
        content: `${title}`,
        files: [tempPath],
      });

      // 清理臨時文件
      setTimeout(() => {
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      }, 5000);
    } catch (error) {
      console.error("[ODOG Canvas Error]", error);
      message.reply("生成圖表時發生錯誤，請稍後再試");
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
      }, 5000);
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
      }, 5000);
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
      }, 5000);
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
      }, 5000);
      return true;
    }
    await message.reply("歷史紀錄更新完成！可用 &odog 查詢結果。");
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
  generateRankingCanvas, // 新增：可單獨使用的Canvas生成函數
};
