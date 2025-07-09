const { CHANNEL_ID, rarityMap } = require("./config");
const {
  getLocalDateString,
  extractUsername,
  loadOdogStats,
  saveOdogStats,
} = require("./utils");

/**
 * 處理歐狗訊息
 * @param {Object} message - Discord 訊息對象
 * @returns {Promise<boolean>} 是否處理成功
 */
async function handleOdogMessage(message) {
  // 檢查是否為目標頻道
  if (message.channelId !== CHANNEL_ID) {
    return false;
  }

  // 檢查是否有 embeds
  if (!message.embeds || message.embeds.length === 0) {
    return false;
  }

  const embed = message.embeds[0];
  const rarity = rarityMap[embed.color];

  if (!rarity) {
    return false;
  }

  try {
    const username = extractUsername(embed);
    const date = getLocalDateString(
      new Date(message.createdTimestamp || Date.now())
    );

    // 載入現有統計數據
    const stats = loadOdogStats();

    // 初始化數據結構
    if (!stats[date]) stats[date] = {};
    if (!stats[date][username]) {
      stats[date][username] = { EX: 0, LR: 0, UR: 0, SSR: 0 };
    }

    // 更新統計數據
    stats[date][username][rarity]++;

    // 保存數據
    saveOdogStats(stats);

    console.log(`[ODOG] 記錄: ${username} 抽到了 ${rarity} (${date})`);

    return true;
  } catch (error) {
    console.error("[ODOG] 處理訊息時發生錯誤:", error);
    return false;
  }
}

/**
 * 檢查訊息是否為歐狗訊息
 * @param {Object} message - Discord 訊息對象
 * @returns {boolean} 是否為歐狗訊息
 */
function isOdogMessage(message) {
  return (
    message.channelId === CHANNEL_ID &&
    message.embeds &&
    message.embeds.length > 0 &&
    rarityMap[message.embeds[0].color]
  );
}

module.exports = {
  handleOdogMessage,
  isOdogMessage,
};
