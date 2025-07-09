const path = require("path");
const fs = require("fs");
const { CHANNEL_ID } = require("./config");
const { loadOdogStats, getLocalDateString } = require("./utils");
const { generateOdogImage } = require("./image-generator");
const { fetchChannelHistory } = require("./history-fetcher");

/**
 * 處理歐狗指令
 * @param {Object} message - Discord 訊息對象
 * @param {Object} client - Discord 客戶端
 * @returns {Promise<boolean>} 是否處理成功
 */
async function handleOdogCommand(message, client) {
  const content = message.content.trim();

  // &odog 指令
  if (content.startsWith("&odog")) {
    return await handleOdogShowCommand(message);
  }

  // &zz 指令
  if (content.startsWith("&zz")) {
    return await handleOdogFetchCommand(message, client);
  }

  return false;
}

/**
 * 處理顯示排行榜指令
 * @param {Object} message - Discord 訊息對象
 * @returns {Promise<boolean>} 是否處理成功
 */
async function handleOdogShowCommand(message) {
  try {
    const stats = loadOdogStats();
    const args = message.content.trim().split(" ");
    let date = getLocalDateString();
    let showAll = false;
    let showDate = date;

    // 解析參數
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
          if (!userStats[user]) {
            userStats[user] = { EX: 0, LR: 0, UR: 0, SSR: 0 };
          }
          for (const r of ["EX", "LR", "UR", "SSR"]) {
            userStats[user][r] += stats[d][user][r];
          }
        }
      }
      title = "所有日期歐狗榜";
    } else {
      if (!stats[showDate] || Object.keys(stats[showDate]).length === 0) {
        await message.reply(`**${showDate}** 尚無抽卡紀錄`);
        return true;
      }
      userStats = stats[showDate];
      title = `${showDate} 歐狗榜`;
    }

    // 生成圖片
    const tempPath = path.resolve(
      __dirname,
      "../../../data/temp/odog_ranking.png"
    );

    // 確保目錄存在
    const tempDir = path.dirname(tempPath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    await generateOdogImage(userStats, title, tempPath);

    await message.reply({
      content: `${title}`,
      files: [tempPath],
    });

    // 不再自動刪除 tempPath 及 HTML，讓用戶可以保留
    // setTimeout(() => {
    //   if (fs.existsSync(tempPath)) {
    //     fs.unlinkSync(tempPath);
    //   }
    // }, 5000);

    return true;
  } catch (error) {
    console.error("[ODOG] 處理顯示指令時發生錯誤:", error);
    await message.reply("生成圖表時發生錯誤，請稍後再試");
    return true;
  }
}

/**
 * 處理爬取歷史記錄指令
 * @param {Object} message - Discord 訊息對象
 * @param {Object} client - Discord 客戶端
 * @returns {Promise<boolean>} 是否處理成功
 */
async function handleOdogFetchCommand(message, client) {
  try {
    const content = message.content.trim();
    let reply;
    let options = {};

    if (content === "&zz") {
      reply = await message.reply("開始爬取全部歷史紀錄，請稍候...");
      options = { days: null, sinceNoon: false };
    } else if (content === "&zz 1d") {
      reply = await message.reply("開始爬取今日 12:00 以後紀錄，請稍候...");
      options = { days: null, sinceNoon: true };
    } else if (content === "&zz 7d") {
      reply = await message.reply("開始爬取過去 7 天紀錄，請稍候...");
      options = { days: 7, sinceNoon: false };
    } else {
      reply = await message.reply("用法：&zz、&zz 1d、&zz 7d");
      setTimeout(() => {
        reply.delete().catch(() => {});
      }, 5000);
      return true;
    }

    // 爬取歷史記錄
    await fetchChannelHistory(client, CHANNEL_ID, options);

    // 刪除提示訊息
    setTimeout(() => {
      reply.delete().catch(() => {});
    }, 5000);

    await message.reply("歷史紀錄更新完成！可用 &odog 查詢結果。");
    return true;
  } catch (error) {
    console.error("[ODOG] 處理爬取指令時發生錯誤:", error);
    await message.reply("爬取歷史記錄時發生錯誤，請稍後再試");
    return true;
  }
}

module.exports = {
  handleOdogCommand,
};
