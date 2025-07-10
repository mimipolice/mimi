const {
  handleReportCommand,
  handleKeywordCommand,
  handleHelpCommand,
  handleTodoCommand,
} = require("../features/commands");
const { handleStockMessage } = require("../features/stock");
const { handleOdogMessage, handleOdogCommand } = require("../features/odog");
const {
  handleAutoReactCommand,
  handleAutoReactMessage,
} = require("../features/autoReact");
const { OdogHistoryHandler } = require("./odogHistoryHandler");
const { KeywordMatcher } = require("./keywordMatcher");

/**
 * 訊息處理器
 */
class MessageHandler {
  constructor(client) {
    this.client = client;
    this.odogHistoryHandler = new OdogHistoryHandler(client);
    this.keywordMatcher = new KeywordMatcher();
  }

  /**
   * 處理訊息
   */
  async handleMessage(message) {
    // 處理幫助指令
    if (message.content.trim().startsWith("&help")) {
      await handleHelpCommand(message);
      return;
    }

    // 處理 ODOG 相關
    await handleOdogMessage(message);
    if (await handleOdogCommand(message, this.client)) return;

    // 處理自動回應指令和訊息
    if (await handleAutoReactCommand(message, this.client)) return;
    await handleAutoReactMessage(message, this.client);

    // 處理各種指令
    handleKeywordCommand(message);
    handleStockMessage(message);
    handleTodoCommand(message);
    handleReportCommand(message);

    // 處理 ODOG 統計指令
    if (message.content.trim() === "&odog") {
      await this.odogHistoryHandler.handleOdogStatsCommand(message);
      return;
    }

    // 處理爬蟲指令
    if (message.content.trim().startsWith("&zz")) {
      await this.odogHistoryHandler.handleCrawlerCommand(message);
      return;
    }

    // 處理關鍵字匹配
    await this.handleKeywordMatching(message);
  }

  /**
   * 處理關鍵字匹配
   */
  async handleKeywordMatching(message) {
    // 跳過機器人訊息和指令
    if (message.author.bot || message.author.id === this.client.user.id) return;
    if (message.content.trim().startsWith("&")) return;

    const matchedKeyword = this.keywordMatcher.findMatch(message.content);
    if (matchedKeyword) {
      await message.reply(matchedKeyword.reply);
    }
  }
}

module.exports = { MessageHandler };
