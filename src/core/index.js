require("dotenv").config();
const { BotManager } = require("./botManager");

/**
 * 應用程式主入口
 * 啟動 Discord Bot
 */
async function main() {
  try {
    const botManager = new BotManager();
    await botManager.start();

    // 優雅關閉處理
    process.on('SIGINT', async () => {
      console.log('\n正在關閉 Bot...');
      await botManager.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n正在關閉 Bot...');
      await botManager.stop();
      process.exit(0);
    });

  } catch (error) {
    console.error('應用程式啟動失敗:', error);
    process.exit(1);
  }
}

// 啟動應用程式
if (require.main === module) {
  main();
}
