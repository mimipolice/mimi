const { APP_CONFIG } = require("./config");
const { FileManager } = require("../utils/fileManager");
const { sleep } = require("../utils/utils");

/**
 * ODOG 歷史處理器
 */
class OdogHistoryHandler {
  constructor(client) {
    this.client = client;
  }

  /**
   * 載入 ODOG 統計資料
   */
  loadOdogStats() {
    return FileManager.readJsonFile(APP_CONFIG.PATHS.ODOG_STATS, {});
  }

  /**
   * 儲存 ODOG 統計資料
   */
  saveOdogStats(stats) {
    FileManager.writeJsonFile(APP_CONFIG.PATHS.ODOG_STATS, stats);
  }

  /**
   * 處理 ODOG 統計指令
   */
  async handleOdogStatsCommand(message) {
    const stats = this.loadOdogStats();
    const date = new Date().toISOString().slice(0, 10);
    
    if (!stats[date] || Object.keys(stats[date]).length === 0) {
      await message.reply("今日尚無抽卡紀錄");
      return;
    }

    const rankingMessage = this.generateRankingMessage(stats[date], date);
    await message.reply(rankingMessage);
  }

  /**
   * 生成排行榜訊息
   */
  generateRankingMessage(dayStats, date) {
    let msg = `**${date} 歐狗榜**\n`;
    const users = Object.keys(dayStats);
    
    // 排序邏輯：先比EX，再LR，再UR，再SSR
    users.sort((a, b) => {
      for (const rarity of ["EX", "LR", "UR", "SSR"]) {
        const aCount = dayStats[a][rarity] || 0;
        const bCount = dayStats[b][rarity] || 0;
        if (bCount !== aCount) {
          return bCount - aCount;
        }
      }
      return 0;
    });

    for (const user of users) {
      const stats = dayStats[user];
      msg += `• ${user}：EX:${stats.EX} LR:${stats.LR} UR:${stats.UR} SSR:${stats.SSR}\n`;
    }
    
    return msg;
  }

  /**
   * 處理爬蟲指令
   */
  async handleCrawlerCommand(message) {
    const content = message.content.trim();
    let stats;

    try {
      if (content === "&zz") {
        await message.reply("開始爬取全部歷史紀錄，請稍候...");
        stats = await this.fetchChannelHistory({ days: null, sinceNoon: false });
      } else if (content === "&zz 1d") {
        await message.reply("開始爬取今日 12:00 以後紀錄，請稍候...");
        stats = await this.fetchChannelHistory({ days: null, sinceNoon: true });
      } else if (content === "&zz 7d") {
        await message.reply("開始爬取過去 7 天紀錄，請稍候...");
        stats = await this.fetchChannelHistory({ days: 7, sinceNoon: false });
      } else {
        await message.reply("用法：&zz、&zz 1d、&zz 7d");
        return;
      }

      await message.reply("歷史紀錄統計完成！可用 &odog 查詢結果。");
    } catch (error) {
      console.error("爬蟲執行失敗:", error);
      await message.reply("爬蟲執行失敗，請稍後再試。");
    }
  }

  /**
   * 獲取頻道歷史記錄
   */
  async fetchChannelHistory({
    days = null,
    sinceNoon = false,
    channelId = "1375058548874149898",
  }) {
    const channel = this.client.channels.cache.get(channelId);
    if (!channel) {
      throw new Error("找不到指定頻道");
    }

    const timeFilter = this.calculateTimeFilter(days, sinceNoon);
    const stats = {};
    let before = undefined;
    let done = false;

    while (!done) {
      const options = { limit: 100 };
      if (before) options.before = before;

      const messages = await channel.messages.fetch(options);
      if (!messages.size) break;

      for (const msg of messages.values()) {
        if (timeFilter && msg.createdTimestamp < timeFilter) {
          done = true;
          break;
        }

        const cardData = this.parseCardMessage(msg);
        if (cardData) {
          this.addToStats(stats, cardData);
        }
      }

      before = messages.last().id;
      if (messages.size < 100) break;
      
      await sleep(APP_CONFIG.INTERVALS.API_DELAY); // 防止 API 過載
    }

    this.saveOdogStats(stats);
    console.log("[ODOG歷史統計]", stats);
    return stats;
  }

  /**
   * 計算時間過濾器
   */
  calculateTimeFilter(days, sinceNoon) {
    const now = new Date();
    
    if (days) {
      return now.getTime() - days * 24 * 60 * 60 * 1000;
    }
    
    if (sinceNoon) {
      const noon = new Date(now);
      noon.setHours(12, 0, 0, 0);
      return noon.getTime();
    }
    
    return null;
  }

  /**
   * 解析卡片訊息
   */
  parseCardMessage(message) {
    if (!message.embeds || message.embeds.length === 0) return null;

    const embed = message.embeds[0];
    const colorStr = embed.color || embed.rawColor || embed.colorString;
    
    // 判斷稀有度
    let rarity = null;
    for (const colorKey in APP_CONFIG.RARITY_MAP) {
      if (colorStr && colorStr.startsWith(colorKey)) {
        rarity = APP_CONFIG.RARITY_MAP[colorKey];
        break;
      }
    }
    
    if (!rarity) return null;

    // 提取用戶名
    let username = "未知";
    if (embed.rawTitle) {
      const userMatch = embed.rawTitle.match(/^(.+?) 抽到了/);
      if (userMatch) username = userMatch[1];
    }

    const date = new Date(message.createdTimestamp || Date.now())
      .toISOString()
      .slice(0, 10);

    return { username, rarity, date };
  }

  /**
   * 添加到統計資料
   */
  addToStats(stats, { username, rarity, date }) {
    if (!stats[date]) stats[date] = {};
    if (!stats[date][username]) {
      stats[date][username] = { EX: 0, LR: 0, UR: 0, SSR: 0 };
    }
    stats[date][username][rarity]++;
  }
}

module.exports = { OdogHistoryHandler };
