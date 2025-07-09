const fs = require("fs");
const { ODOG_STATS_PATH } = require("./config");

/**
 * 延遲函數
 * @param {number} ms - 延遲毫秒數
 * @returns {Promise} Promise
 */
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * 獲取本地日期字符串
 * @param {Date} date - 日期對象
 * @param {number} tzOffset - 時區偏移 (預設 +8 為台北時間)
 * @returns {string} 格式化的日期字符串 YYYY-MM-DD
 */
function getLocalDateString(date = new Date(), tzOffset = 8) {
  const local = new Date(date.getTime() + tzOffset * 60 * 60 * 1000);
  return (
    local.getUTCFullYear() +
    "-" +
    String(local.getUTCMonth() + 1).padStart(2, "0") +
    "-" +
    String(local.getUTCDate()).padStart(2, "0")
  );
}

/**
 * 載入歐狗統計數據
 * @returns {Object} 統計數據對象
 */
function loadOdogStats() {
  if (!fs.existsSync(ODOG_STATS_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(ODOG_STATS_PATH, "utf8"));
  } catch (error) {
    console.error("[ODOG] 載入統計數據失敗:", error);
    return {};
  }
}

/**
 * 保存歐狗統計數據
 * @param {Object} stats - 統計數據對象
 */
function saveOdogStats(stats) {
  try {
    // 確保目錄存在
    const dir = require("path").dirname(ODOG_STATS_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(ODOG_STATS_PATH, JSON.stringify(stats, null, 2));
  } catch (error) {
    console.error("[ODOG] 保存統計數據失敗:", error);
  }
}

/**
 * 從 Discord 訊息中提取用戶名
 * @param {Object} embed - Discord embed 對象
 * @returns {string} 用戶名
 */
function extractUsername(embed) {
  let username = "未知";

  // 從標題提取
  const title = embed.title || "";
  if (title) {
    const userMatch = title.match(/^(.+?) 抽到了/);
    if (userMatch) username = userMatch[1];
  }

  // 從作者名稱提取
  if (username === "未知" && embed.author?.name) {
    username = embed.author.name;
  }

  return username;
}

/**
 * 排序用戶統計數據
 * @param {Object} userStats - 用戶統計數據
 * @returns {Array} 排序後的用戶名陣列
 */
function sortUserStats(userStats) {
  const users = Object.keys(userStats);
  return users.sort((a, b) => {
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

    // 如果總數相同，按稀有度排序
    for (const r of ["EX", "LR", "UR", "SSR"]) {
      if ((userStats[b][r] || 0) !== (userStats[a][r] || 0)) {
        return (userStats[b][r] || 0) - (userStats[a][r] || 0);
      }
    }
    return 0;
  });
}

module.exports = {
  sleep,
  getLocalDateString,
  loadOdogStats,
  saveOdogStats,
  extractUsername,
  sortUserStats,
};
