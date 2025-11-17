# Anti-Spam 不工作除錯指南

## 當前狀況

- ✅ messageCreate 事件有收到（其他功能正常）
- ✅ 資料庫設定正確（5 條訊息 / 10 秒）
- ✅ Redis 連線正常
- ❌ 監控腳本顯示快取是空的
- ❌ Anti-spam 沒有觸發

## 可能原因

1. `handleAntiSpam` 函式提前 return
2. Redis 寫入失敗但沒有錯誤
3. 日誌級別設定為 ERROR，看不到 DEBUG/INFO 日誌
4. 發生未捕獲的錯誤

## 除錯步驟

### 步驟 1: 檢查日誌級別

檢查 `.env` 檔案：

```bash
grep NODE_ENV .env
```

如果是 `NODE_ENV=production`，可能看不到 DEBUG 日誌。

**臨時修改**（測試用）：
```bash
# 編輯 .env
NODE_ENV=development

# 重啟 bot
npm run build
pm2 restart your-bot-name
```

### 步驟 2: 測試 Redis 寫入

```bash
npm run build
node dist/scripts/test-redis-write.js
```

這會測試 Redis 的讀寫功能，並建立一個測試用的 anti-spam 快取。

### 步驟 3: 查看詳細日誌

重新編譯並重啟（包含新的除錯日誌）：

```bash
npm run build
pm2 restart your-bot-name
pm2 logs your-bot-name --lines 0
```

然後在 Discord 發送一條訊息，你應該會看到：

```
[Anti-Spam] Processing message from YourName (1191600548844163194) in guild 1256599582801137764
[Anti-Spam] Settings for guild 1256599582801137764: { ... }
[Anti-Spam] User YourName (1191600548844163194): { totalMessages: 1, ... }
[Anti-Spam] No spam detected, updating cache for YourName
[Anti-Spam] Cache updated successfully for YourName
```

### 步驟 4: 如果看不到任何 Anti-Spam 日誌

表示 `handleAntiSpam` 提前 return 了。檢查：

#### 4.1 檢查是否是 Bot 訊息
```bash
# 在日誌中搜尋
pm2 logs your-bot-name --lines 100 | grep "Skipping bot message"
```

#### 4.2 檢查是否在忽略清單
```bash
# 執行診斷
node dist/scripts/diagnose-antispam.js | grep -A 5 "ignoredUsers"
```

如果你的 User ID 在清單中，從 `.env` 移除：
```bash
# 編輯 .env，移除你的 ID
ANTISPAM_IGNORED_USERS=

# 重啟
pm2 restart your-bot-name
```

#### 4.3 檢查是否有 member 物件
在日誌中搜尋：
```bash
pm2 logs your-bot-name --lines 100 | grep "No member object"
```

### 步驟 5: 檢查錯誤日誌

```bash
# 搜尋錯誤
pm2 logs your-bot-name --lines 200 | grep -i "error"

# 特別搜尋 anti-spam 相關錯誤
pm2 logs your-bot-name --lines 200 | grep -i "antispam.*error"
```

### 步驟 6: 手動檢查 Redis

```bash
redis-cli

# 檢查所有 anti-spam 相關的 key
KEYS antispam:*

# 檢查你的 User ID
GET antispam:1191600548844163194

# 檢查設定快取
GET antiSpamSettings:1256599582801137764

# 退出
exit
```

### 步驟 7: 即時監控（雙終端）

**終端 1**: 監控快取
```bash
node dist/scripts/monitor-antispam.js 1191600548844163194
```

**終端 2**: 監控日誌
```bash
pm2 logs your-bot-name --lines 0
```

然後在 Discord 發送訊息，同時觀察兩個終端的輸出。

### 步驟 8: 如果還是沒有日誌

在 `src/events/messageCreate.ts` 的最前面加入測試日誌：

```typescript
async execute(message: Message, client: Client, services: Services, databases: Databases) {
  console.log(`[DEBUG] messageCreate triggered: ${message.author.tag} - bot: ${message.author.bot} - guild: ${message.guild?.id}`);
  
  if (message.author.bot || !message.guild) {
    return;
  }
  
  console.log(`[DEBUG] Passed initial checks, will call handleAntiSpam`);
  
  // ... 原有程式碼
}
```

重新編譯並測試：
```bash
npm run build
pm2 restart your-bot-name
pm2 logs your-bot-name --lines 0
```

## 預期的正常輸出

當一切正常時，發送一條訊息應該看到：

```
[DEBUG] messageCreate triggered: YourName#1234 - bot: false - guild: 1256599582801137764
[DEBUG] Passed initial checks, will call handleAntiSpam
[Anti-Spam] Processing message from YourName (1191600548844163194) in guild 1256599582801137764
[Anti-Spam] Settings for guild 1256599582801137764: {
  spamThreshold: 5,
  timeWindow: 10000,
  timeoutDuration: 20000,
  ...
}
[Anti-Spam] User YourName (1191600548844163194): {
  totalMessages: 1,
  messagesInChannel: 1,
  threshold: 5,
  timeWindow: 10000,
  isPunished: false
}
[Anti-Spam] No spam detected, updating cache for YourName
[Anti-Spam] Cache updated successfully for YourName
```

同時，監控腳本應該顯示：

```
[2025-11-17T10:15:30.000Z] Cache updated:
  Messages tracked: 1
  Recent messages:
    1. 0.1s ago in channel 1234567890
  Punished: No
```

## 快速檢查清單

- [ ] `NODE_ENV` 設為 `development`（測試用）
- [ ] 重新編譯並重啟 Bot
- [ ] Redis 測試腳本通過
- [ ] 發送訊息後看到 `[Anti-Spam] Processing message` 日誌
- [ ] 監控腳本顯示快取更新
- [ ] 快速發送 5 條訊息觸發 timeout

## 如果全部都正常但還是不觸發

檢查 `checkSpam` 函式的邏輯：

```bash
node dist/scripts/test-antispam-logic.js
```

這會模擬 5 條訊息並顯示是否應該觸發。

## 回報資訊

如果問題仍未解決，請提供：

1. `pm2 logs your-bot-name --lines 50` 的輸出（發送訊息後）
2. `redis-cli KEYS antispam:*` 的輸出
3. `node dist/scripts/test-redis-write.js` 的輸出
4. `.env` 中的 `NODE_ENV` 和 `ANTISPAM_*` 設定
