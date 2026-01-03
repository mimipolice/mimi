import winston from "winston";
import { EnhancedDiscordWebhookTransport } from "./discordWebhookTransport";

// 1. (新增) 建立一個自訂 format，專門將 level 字串轉為大寫
//    這一步是為了解決問題的核心
const upperCaseLevel = winston.format((info) => {
  info.level = info.level.toUpperCase();
  return info;
});

const transports: winston.transport[] = [
  new winston.transports.File({ filename: "error.log", level: "error" }),
  new winston.transports.File({ filename: "combined.log" }),
];

// Add Discord webhook transport if configured
if (process.env.ERROR_WEBHOOK_URL) {
  transports.push(
    new EnhancedDiscordWebhookTransport({
      level: "error", // Only send error logs to Discord
      webhookUrl: process.env.ERROR_WEBHOOK_URL,
      // Rate limiting: 15 messages per 10 minutes
      windowDurationMs: 10 * 60 * 1000,
      maxMessagesPerWindow: 15,
      // Aggregate similar errors for 30 seconds
      aggregationWindowMs: 30 * 1000,
      // Send summary every 5 minutes
      summaryIntervalMs: 5 * 60 * 1000,
      enableSummary: true,
      // CRITICAL errors (DB down) bypass rate limit
      criticalBypassRateLimit: true,
    })
  );
}

const logger = winston.createLogger({
  level: process.env.NODE_ENV === "development" ? "debug" : "info",
  // 這是寫入檔案的 format，沒有顏色，所以直接轉大寫即可
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }), // Capture stack traces
    winston.format.printf(({ level, message, timestamp, stack, ...rest }) => {
      // (優化) 讓檔案日誌的 level 也變成大寫，以求格式一致
      const levelStr = `[${level.toUpperCase()}]`;
      const timestampStr = timestamp;
      const messageStr = message;
      const stackStr = stack ? `\n${stack}` : "";
      const metaStr = Object.keys(rest).length
        ? JSON.stringify(rest, null, 2)
        : "";
      return `${levelStr} ${timestampStr}: ${messageStr}${stackStr} ${metaStr}`;
    })
  ),
  transports,
});

// 無論在哪個環境，都新增 console 輸出，但 level 會根據環境變動
logger.add(
  new winston.transports.Console({
    // 在 development 顯示 debug，在 production 顯示 info
    level: process.env.NODE_ENV === "development" ? "debug" : "info",
    // 2. (修改) 調整 Console 的 format 組合
    format: winston.format.combine(
      // 重要：調整了以下 format 的順序
      winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), // 步驟一：先加上時間戳
      upperCaseLevel(), // 步驟二：將 level 轉為大寫 (此時還是純文字)
      winston.format.colorize(), // 步驟三：對已經大寫的 level 上色
      winston.format.printf(({ level, message, timestamp, ...rest }) => {
        // 3. (修改) 簡化 printf 函式
        // 現在傳入的 'level' 已經是處理好的「彩色大寫字串」，例如：`\u001b[32mINFO\u001b[39m`
        // 所以我們不再需要手動呼叫 toUpperCase()
        const levelStr = `[${level}]`;
        const timestampStr = timestamp;
        const messageStr = message;
        const metaStr = Object.keys(rest).length
          ? JSON.stringify(rest, null, 2)
          : "";
        return `${levelStr} ${timestampStr}: ${messageStr} ${metaStr}`;
      })
    ),
  })
);

export default logger;
