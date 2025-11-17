# Anti-Spam 不工作 - 快速修復清單

## 問題：Bot 沒有收到 messageCreate 事件

## ✅ 立即修復步驟

### 1. 啟用 Discord Intents（最可能的原因）

前往：https://discord.com/developers/applications

1. 選擇你的 Bot（Client ID: `1401130025411018772`）
2. 點擊左側 **"Bot"**
3. 向下滾動到 **"Privileged Gateway Intents"**
4. **啟用以下選項**：
   - ☑️ **MESSAGE CONTENT INTENT** ← 最重要！
   - ☑️ **SERVER MEMBERS INTENT**
5. 點擊 **"Save Changes"**
6. 在 VPS 上重啟 Bot：
   ```bash
   pm2 restart your-bot-name
   ```

### 2. 驗證修復

在 VPS 上執行：

```bash
# 方法 1: 使用診斷腳本（會等待你發送訊息）
npm run build
node dist/scripts/diagnose-intents.js

# 然後在 Discord 發送任意訊息
```

或

```bash
# 方法 2: 查看日誌
pm2 logs your-bot-name --lines 20

# 然後在 Discord 發送訊息，看是否有日誌輸出
```

### 3. 測試 Anti-Spam

如果步驟 2 確認 Bot 能收到訊息，快速發送 5 條訊息測試：

```
test 1
test 2
test 3
test 4
test 5
```

應該會被 timeout 20 秒。

## 🔍 如果還是不行

### 檢查 Bot 權限

確認 Bot 在伺服器中有以下權限：
- ✅ View Channels
- ✅ Send Messages
- ✅ Read Message History
- ✅ Timeout Members

### 檢查 Bot 是否在線

```bash
pm2 status
# 或
pm2 logs your-bot-name --lines 5
```

### 檢查 messageCreate 事件是否註冊

```bash
# 在專案目錄
ls -la src/events/messageCreate.ts
```

應該存在這個檔案。

### 手動測試訊息接收

在 `src/events/messageCreate.ts` 最前面加入：

```typescript
async execute(message: Message, client: Client, services: Services, databases: Databases) {
  console.log(`[TEST] Received message from ${message.author.tag}: ${message.content}`);
  
  // ... 原有程式碼
}
```

重新編譯並重啟：
```bash
npm run build
pm2 restart your-bot-name
pm2 logs your-bot-name
```

發送訊息，看是否有 `[TEST]` 日誌。

## 📋 完整診斷

如果以上都無法解決，執行完整診斷：

```bash
# 1. 檢查 intents
node dist/scripts/diagnose-intents.js

# 2. 檢查 anti-spam 設定
node dist/scripts/diagnose-antispam.js

# 3. 監控使用者快取（替換 USER_ID）
node dist/scripts/monitor-antispam.js YOUR_USER_ID

# 4. 查看完整日誌
pm2 logs your-bot-name --lines 100
```

## 📚 詳細文件

- `DISCORD_INTENTS_FIX.md` - Discord Intents 詳細說明
- `ANTISPAM_QUICK_TEST.md` - Anti-Spam 測試指南
- `ANTISPAM_DEBUG.md` - 完整除錯指南

## 🎯 最可能的原因排序

1. **MESSAGE CONTENT INTENT 未啟用**（90% 機率）
2. Bot 沒有頻道權限（5% 機率）
3. messageCreate 事件未正確註冊（3% 機率）
4. 其他問題（2% 機率）

## ⚡ 一鍵測試指令

```bash
# 在 VPS 上執行
cd /path/to/your/bot
npm run build && \
node dist/scripts/diagnose-intents.js &
echo "請在 Discord 發送一條訊息..."
```
