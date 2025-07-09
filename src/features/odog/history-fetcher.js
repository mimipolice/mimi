const { CHANNEL_ID, rarityMap } = require("./config");
const {
  sleep,
  getLocalDateString,
  extractUsername,
  saveOdogStats,
} = require("./utils");

/**
 * 爬取歐狗歷史記錄
 * @param {Object} options - 選項
 * @param {number|null} options.days - 天數限制
 * @param {boolean} options.sinceNoon - 是否從中午開始
 * @param {Object} options.channel - Discord 頻道對象
 * @param {Object} options.client - Discord 客戶端
 * @returns {Promise<Object>} 統計數據
 */
async function fetchOdogHistory({
  days = null,
  sinceNoon = false,
  channel,
  client,
}) {
  if (!channel) {
    console.error("[ODOG] 找不到目標頻道");
    return {};
  }

  let before = undefined;
  const now = new Date();
  let sinceTs = 0;

  // 計算時間範圍
  if (days) {
    sinceTs = now.getTime() - days * 24 * 60 * 60 * 1000;
  }
  if (sinceNoon) {
    const noon = new Date(now);
    noon.setHours(12, 0, 0, 0);
    sinceTs = noon.getTime();
  }

  const stats = {};
  let messageCount = 0;
  let processedCount = 0;

  console.log(`[ODOG] 開始爬取歷史記錄...`);

  while (true) {
    try {
      const options = { limit: 100 };
      if (before) options.before = before;

      const messages = await channel.messages.fetch(options);
      if (!messages.size) break;

      messageCount += messages.size;

      for (const msg of messages.values()) {
        if (!msg.embeds || msg.embeds.length === 0) continue;

        const embed = msg.embeds[0];
        const rarity = rarityMap[embed.color];
        if (!rarity) continue;

        // 檢查時間範圍
        if (days || sinceNoon) {
          if (msg.createdTimestamp < sinceTs) continue;
        }

        const username = extractUsername(embed);
        const date = getLocalDateString(
          new Date(msg.createdTimestamp || Date.now())
        );

        // 初始化數據結構
        if (!stats[date]) stats[date] = {};
        if (!stats[date][username]) {
          stats[date][username] = { EX: 0, LR: 0, UR: 0, SSR: 0 };
        }

        stats[date][username][rarity]++;
        processedCount++;
      }

      before = messages.last().id;
      if (messages.size < 100) break;

      // 避免請求過於頻繁
      await sleep(500);
    } catch (error) {
      console.error("[ODOG] 爬取訊息時發生錯誤:", error);
      break;
    }
  }

  console.log(
    `[ODOG] 爬取完成: 處理了 ${messageCount} 條訊息，找到 ${processedCount} 條抽卡記錄`
  );

  // 保存統計數據
  saveOdogStats(stats);
  return stats;
}

/**
 * 爬取指定頻道的歷史記錄
 * @param {Object} client - Discord 客戶端
 * @param {string} channelId - 頻道 ID
 * @param {Object} options - 選項
 * @returns {Promise<Object>} 統計數據
 */
async function fetchChannelHistory(
  client,
  channelId = CHANNEL_ID,
  options = {}
) {
  const channel = client.channels.cache.get(channelId);
  if (!channel) {
    throw new Error(`找不到頻道: ${channelId}`);
  }

  return await fetchOdogHistory({
    channel,
    client,
    ...options,
  });
}

module.exports = {
  fetchOdogHistory,
  fetchChannelHistory,
};
