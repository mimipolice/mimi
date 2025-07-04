const { Client } = require("discord.js-selfbot-v13");
require("dotenv").config();
const {
  handleSleepCommand,
  handleReportCommand,
  handleNoteCommand,
  handleConfigCommand,
} = require("./commands");
const { handleStockMessage } = require("./stock");

const client = new Client();

const CHANNEL_ID = "1390554923862720572"; // 更換為你的頻道 ID
const TOKEN = process.env.TOKEN;

function triggerStockCommand(channel) {
  try {
    lastQueryTimestamp = Date.now();
    channel.sendSlash("1221230734602141727", "stock");
    console.log("📤 已發送 /stock 指令");
  } catch (err) {
    console.error("❌ /stock 指令發送失敗:", err);
  }
}

client.on("ready", () => {
  console.log(`✅ Bot 已上線: ${client.user.tag}`);

  const channel = client.channels.cache.get(CHANNEL_ID);
  if (!channel) return console.error("⚠️ 找不到頻道");

  // 啟動时立即執行
  triggerStockCommand(channel);

  // 每5分鐘自動查價
  setInterval(() => {
    triggerStockCommand(channel);
  }, 5 * 60 * 1000);
});

client.on("messageCreate", (message) => {
  handleStockMessage(message);
  handleSleepCommand(message);
  handleReportCommand(message);
  handleNoteCommand(message);
  handleConfigCommand(message);
});

client.on("messageUpdate", (_, newMessage) => {
  handleStockMessage(newMessage);
});

client.login(TOKEN);
