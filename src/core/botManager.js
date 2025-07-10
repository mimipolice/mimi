const { Client } = require("discord.js-selfbot-v13");
const { APP_CONFIG } = require("./config");
const { logStockStatus, logDirect } = require("../utils/logger");
const { sleep } = require("../utils/utils");

/**
 * Discord Bot 管理器
 */
class BotManager {
  constructor() {
    this.client = new Client();
    this.lastQueryTimestamp = 0;
    this.setupEventHandlers();
  }

  /**
   * 設置事件處理器
   */
  setupEventHandlers() {
    this.client.on("ready", () => this.onReady());
    this.client.on("messageCreate", (message) => this.onMessageCreate(message));
    this.client.on("messageUpdate", (_, newMessage) => this.onMessageUpdate(newMessage));
  }

  /**
   * Bot 準備就緒事件
   */
  async onReady() {
    console.log(`✅ Bot 已上線: ${this.client.user.tag}`);

    const channel = this.client.channels.cache.get(APP_CONFIG.CHANNEL_ID);
    if (!channel) {
      console.error("⚠️ 找不到頻道");
      return;
    }

    // 啟動時立即執行
    await this.triggerStockCommand(channel);

    // 設置定時任務
    this.setupScheduledTasks(channel);
  }

  /**
   * 設置定時任務
   */
  setupScheduledTasks(channel) {
    // 每5分鐘自動查價與推播新聞
    setInterval(() => {
      this.triggerStockCommand(channel);
    }, APP_CONFIG.INTERVALS.STOCK_CHECK);
  }

  /**
   * 觸發股票指令
   */
  async triggerStockCommand(channel) {
    try {
      this.lastQueryTimestamp = Date.now();
      await channel.sendSlash("1221230734602141727", "stock");
      logStockStatus("send", "📤 已發送 /stock 指令");
    } catch (err) {
      logDirect(`❌ /stock 指令發送失敗: ${err}`);
    }
  }

  /**
   * 訊息創建事件
   */
  async onMessageCreate(message) {
    // 導入處理器以避免循環依賴
    const { MessageHandler } = require("./messageHandler");
    const handler = new MessageHandler(this.client);
    await handler.handleMessage(message);
  }

  /**
   * 訊息更新事件
   */
  async onMessageUpdate(oldMessage, newMessage) {
    const { handleStockMessage } = require("../features/stock");
    handleStockMessage(newMessage);
  }

  /**
   * 啟動 Bot
   */
  async start() {
    try {
      await this.client.login(APP_CONFIG.TOKEN);
    } catch (error) {
      console.error("Bot 啟動失敗:", error);
      throw error;
    }
  }

  /**
   * 停止 Bot
   */
  async stop() {
    try {
      await this.client.destroy();
      console.log("Bot 已停止");
    } catch (error) {
      console.error("Bot 停止失敗:", error);
    }
  }
}

module.exports = { BotManager };
