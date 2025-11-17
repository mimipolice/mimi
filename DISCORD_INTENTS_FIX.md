# Discord Intents 設定問題修復

## 問題診斷

Bot 沒有收到 `messageCreate` 事件，這表示 Discord Gateway Intents 沒有正確啟用。

雖然程式碼中已經設定了正確的 intents：
```typescript
intents: [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,      // ✅ 需要這個
  GatewayIntentBits.MessageContent,     // ✅ 需要這個
  GatewayIntentBits.DirectMessages,
  GatewayIntentBits.GuildScheduledEvents,
  GatewayIntentBits.GuildMessageReactions,
]
```

但這些 intents 必須在 **Discord Developer Portal** 中啟用才能生效。

## 修復步驟

### 1. 前往 Discord Developer Portal

訪問：https://discord.com/developers/applications

### 2. 選擇你的 Bot 應用程式

找到你的 Bot（Client ID: `1401130025411018772`）

### 3. 進入 Bot 設定頁面

點擊左側選單的 **"Bot"**

### 4. 啟用 Privileged Gateway Intents

向下滾動到 **"Privileged Gateway Intents"** 區塊，啟用以下選項：

#### ✅ 必須啟用（用於 Anti-Spam）：

- **MESSAGE CONTENT INTENT** ⚠️ 這是最重要的！
  - 允許 Bot 讀取訊息內容
  - 用於 anti-spam、keyword、autoreact 等功能

- **SERVER MEMBERS INTENT**
  - 允許 Bot 存取成員資訊
  - 用於 timeout 功能

#### 建議啟用：

- **PRESENCE INTENT**
  - 允許 Bot 看到成員的在線狀態
  - 非必需，但某些功能可能需要

### 5. 儲存變更

點擊 **"Save Changes"** 按鈕

### 6. 重啟 Bot

在 VPS 上重啟 Bot：

```bash
pm2 restart your-bot-name
# 或
npm run start
```

### 7. 驗證修復

重啟後，在 Discord 中發送一條訊息，然後檢查日誌：

```bash
pm2 logs your-bot-name --lines 20
```

你應該會看到類似的日誌：
```
[Anti-Spam] Processing message from YourName in guild 1256599582801137764
```

## 為什麼需要這些 Intents？

### MESSAGE CONTENT INTENT

Discord 在 2022 年 9 月後要求所有 Bot 明確申請此權限才能讀取訊息內容。

**沒有此權限時**：
- Bot 可以收到 `messageCreate` 事件
- 但 `message.content` 會是空字串
- 無法進行 anti-spam、keyword 檢測

**啟用後**：
- Bot 可以讀取完整的訊息內容
- Anti-spam、keyword、autoreact 等功能正常運作

### SERVER MEMBERS INTENT

**用途**：
- 存取 `GuildMember` 物件
- 執行 timeout 操作
- 檢查成員角色

## 驗證 Intents 是否生效

### 方法 1: 檢查日誌

發送訊息後，查看是否有 anti-spam 相關日誌：

```bash
pm2 logs your-bot-name --lines 50 | grep -i "anti-spam"
```

### 方法 2: 測試訊息內容

建立一個簡單的測試指令：

```typescript
// 在任何頻道發送: ?test
if (message.content === '?test') {
  await message.reply(`收到訊息內容: "${message.content}"`);
}
```

如果 Bot 能正確回覆，表示 MESSAGE CONTENT INTENT 已啟用。

### 方法 3: 使用診斷腳本

```bash
node dist/scripts/diagnose-intents.js
```

## 常見問題

### Q: 我已經啟用了 intents，但還是不行？

A: 確保：
1. 點擊了 "Save Changes" 按鈕
2. 重啟了 Bot
3. 等待 1-2 分鐘讓 Discord 同步設定

### Q: 啟用 MESSAGE CONTENT INTENT 時顯示警告？

A: Discord 會警告這是 "Privileged Intent"，需要驗證。如果你的 Bot 在 75 個以上的伺服器，需要通過 Discord 的審核。

### Q: 我的 Bot 在很多伺服器，無法啟用？

A: 需要向 Discord 申請驗證：
1. 在 Developer Portal 填寫 Bot 資訊
2. 說明為什麼需要這個權限
3. 等待 Discord 審核（通常 1-2 週）

### Q: 有沒有不需要 MESSAGE CONTENT INTENT 的替代方案？

A: 沒有。Anti-spam 功能必須讀取訊息內容和頻率，這是核心需求。

## 測試清單

啟用 intents 並重啟後，測試以下功能：

- [ ] 發送訊息後，Bot 日誌顯示 anti-spam 檢測
- [ ] 快速發送 5 條訊息，觸發 timeout
- [ ] Keyword 自動回覆功能正常
- [ ] Autoreact 功能正常
- [ ] 收到 timeout 通知和 DM

## 下一步

完成 intents 設定後，執行完整的 anti-spam 測試：

```bash
# 參考測試指南
cat ANTISPAM_QUICK_TEST.md
```
