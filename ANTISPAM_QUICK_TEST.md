# Anti-Spam 快速測試指南

根據診斷結果，你的設定是：
- **閾值**: 5 條訊息
- **時間窗口**: 10 秒
- **Timeout 時長**: 20 秒（測試用）

## 在 VPS 上執行以下步驟

### 1. 重新編譯並部署（包含新的除錯日誌）

```bash
npm run build
pm2 restart your-bot-name
# 或
npm run start
```

### 2. 開啟即時監控（在另一個終端）

```bash
# 替換成你的 Discord User ID
node dist/scripts/monitor-antispam.js YOUR_USER_ID
```

### 3. 在 Discord 中測試

在伺服器 `1256599582801137764` 的任一頻道中：

**快速發送 5 條訊息**（10 秒內）：
```
test 1
test 2
test 3
test 4
test 5
```

### 4. 檢查結果

#### 預期行為：
1. 監控腳本應該顯示訊息計數增加
2. 發送第 5 條訊息時，應該觸發 timeout
3. Bot 應該在頻道中發送通知訊息
4. 你應該收到 DM 包含申訴按鈕
5. 管理員頻道應該收到通知

#### 如果沒有觸發，檢查：

```bash
# 查看 Bot 日誌
pm2 logs your-bot-name --lines 50

# 搜尋 anti-spam 相關日誌
pm2 logs your-bot-name --lines 200 | grep -i "anti-spam"

# 檢查使用者快取
node dist/scripts/check-antispam-cache.js YOUR_USER_ID
```

### 5. 測試邏輯腳本

如果還是不行，執行邏輯測試：

```bash
node dist/scripts/test-antispam-logic.js
```

這會模擬 5 條訊息並顯示檢測邏輯是否正確。

## 可能的問題

### 問題 A: messageCreate 事件沒有觸發

**測試方法**: 在任何頻道發送訊息，檢查日誌是否有任何輸出

```bash
pm2 logs your-bot-name --lines 20
```

如果完全沒有日誌，表示 messageCreate 事件沒有註冊。

### 問題 B: handleAntiSpam 沒有被呼叫

**檢查**: `src/events/messageCreate.ts` 中是否有這行：

```typescript
await handleAntiSpam(message);
```

### 問題 C: 你的角色在忽略清單中

**檢查**: 執行診斷腳本時顯示的 `ignored_roles`

```bash
node dist/scripts/diagnose-antispam.js
```

### 問題 D: Bot 沒有 Moderate Members 權限

**檢查**: 在 Discord 中查看 Bot 的角色權限，確認有 "Timeout Members" 權限

### 問題 E: 訊息發送間隔太長

確保 5 條訊息在 **10 秒內**發送完畢。如果超過 10 秒，舊的訊息會被過濾掉。

## 除錯日誌說明

新版本加入了詳細的除錯日誌，你應該會看到類似：

```
[Anti-Spam] User YourName (123456789): {
  totalMessages: 5,
  messagesInChannel: 5,
  threshold: 5,
  timeWindow: 10000,
  isPunished: false
}
[Anti-Spam] SPAM DETECTED for YourName: Fast single-channel spam
```

如果看到 `totalMessages: 5` 但沒有 "SPAM DETECTED"，表示檢測邏輯有問題。

## 手動清除快取（如果需要）

```bash
redis-cli
DEL antispam:YOUR_USER_ID
DEL antiSpamSettings:1256599582801137764
exit
```

## 臨時降低閾值（更容易測試）

```bash
# 在 Discord 中執行
/config set anti_spam_message_threshold 3
/config set anti_spam_time_window 10000

# 清除快取
redis-cli DEL antiSpamSettings:1256599582801137764

# 重啟 bot
pm2 restart your-bot-name
```

現在只需要 3 條訊息就會觸發。

## 回報結果

執行測試後，請提供：
1. 監控腳本的輸出
2. Bot 日誌中的 anti-spam 相關訊息
3. 是否收到 timeout 和 DM
