/**
 * 歐狗排行榜功能 - 模組化版本
 *
 * 這個檔案現在作為向後兼容的入口點，
 * 實際功能已經分離到 src/features/odog/ 目錄下的各個模組中
 */

// 直接導入各個模組，避免循環依賴
const messageHandler = require("./odog/message-handler");
const commandHandler = require("./odog/command-handler");
const utils = require("./odog/utils");
const htmlGenerator = require("./odog/html-generator");
const historyFetcher = require("./odog/history-fetcher");

// 向後兼容的導出
module.exports = {
  // 主要處理函數
  handleOdogMessage: messageHandler.handleOdogMessage,
  handleOdogCommand: commandHandler.handleOdogCommand,

  // 數據操作
  loadOdogStats: utils.loadOdogStats,
  saveOdogStats: utils.saveOdogStats,

  // 歷史記錄爬取
  fetchOdogHistory: historyFetcher.fetchOdogHistory,

  // HTML 生成
  generateHTML: htmlGenerator.generateHTML,
};
