/**
 * 歐狗排行榜模組
 *
 * 功能：
 * - 自動記錄抽卡訊息
 * - 生成排行榜圖片
 * - 爬取歷史記錄
 * - 支援多種指令
 */

// 直接導入各個模組
const messageHandler = require("./message-handler");
const commandHandler = require("./command-handler");
const utils = require("./utils");
const htmlGenerator = require("./html-generator");
const historyFetcher = require("./history-fetcher");

// 導出所有主要功能
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
