const path = require("path");

// 檔案路徑配置
const ODOG_STATS_PATH = path.resolve(
  __dirname,
  "../../../data/json/odog_stats.json"
);

// 稀有度映射配置
const rarityMap = {
  65535: "EX", // 青色
  16711680: "LR", // 紅色
  16729344: "UR", // 橘色
  16766720: "SSR", // 金色
};

// 稀有度顏色配置
const rarityColors = {
  EX: "#0099FF", // 青色
  LR: "#FF0000", // 紅色
  UR: "#FF9900", // 橘色
  SSR: "#FFD700", // 金色
};

// 稀有度圖標配置

const rarityIcons = {
  EX: "<:worrynani:916708772590800956>",
  LR: "<:frogfire:1390753587444977714>",
  UR: "<:worrysad:916708759806550066>",
  SSR: "<:images7:1328731422248407132>",
};

// Discord 頻道配置
const CHANNEL_ID = "1375058548874149898";

module.exports = {
  ODOG_STATS_PATH,
  rarityMap,
  rarityColors,
  rarityIcons,
  CHANNEL_ID,
};
