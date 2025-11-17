# Anti-Spam 功能診斷指南

## 問題描述
在伺服器 `1256599582801137764` 中，10 秒內發送超過 5 條訊息沒有觸發 timeout。

## 可能的原因

1. **messageCreate 事件沒有被觸發**
2. **Anti-spam handler 沒有被執行**
3. **資料庫/快取設定問題**
4. **使用者在忽略清單中**
5. **Bot 權限不足**
6. **Redis 連線問題**

## 診斷步驟

### 1. 在 VPS 上執行診斷腳本

```bash
# SSH 到 VPS
ssh your-vps

# 進入專案目錄
cd /path/to/your/bot

# 編譯並執行診斷腳本
npm run build
node dist/scripts/diagnose-antispam.js
```

### 2. 檢查使用者快取

修改 `src/scripts/check-antispam-cache.ts` 中的 `YOUR_USER_ID_HERE` 為你的 Discord User ID，然後執行：

```bash
npm run build
node dist/scripts/check-antispam-cache.js
```

### 3. 檢查 Bot 日誌

```bash
# 查看最近的日誌
pm2 logs your-bot-name --lines 100

# 或如果使用 systemd
journalctl -u your-bot-service -n 100

# 搜尋 anti-spam 相關日誌
pm2 logs your-bot-name --lines 1000 | grep -i "anti-spam"
```

### 4. 手動測試

在 Discord 中執行以下指令來檢查設定：

```
/config show anti_spam
```

### 5. 檢查資料庫

連線到 PostgreSQL 並執行：

```sql
-- 檢查 anti_spam_settings 表
SELECT * FROM anti_spam_settings WHERE guildid = '1256599582801137764';

-- 檢查 anti_spam_logs 表
SELECT * FROM anti_spam_logs WHERE guild_id = '1256599582801137764';

-- 檢查表結構
\d anti_spam_settings
\d anti_spam_logs
```

### 6. 檢查 Bot 權限

確認 Bot 在該伺服器有以下權限：
- ✅ Moderate Members (Timeout Members)
- ✅ Send Messages
- ✅ Read Message History

### 7. 檢查 Redis

```bash
# 連線到 Redis
redis-cli

# 檢查 anti-spam 相關的 key
KEYS antispam:*

# 檢查特定使用者的資料
GET antispam:YOUR_USER_ID

# 檢查設定快取
GET antiSpamSettings:1256599582801137764
```

## 常見問題修復

### 問題 1: messageCreate 事件沒有註冊

檢查 `src/events/messageCreate.ts` 是否正確匯出：

```typescript
module.exports = {
  name: Events.MessageCreate,
  once: false,
  async execute(message, client, services, databases) {
    // ...
    await handleAntiSpam(message);
    // ...
  },
};
```

### 問題 2: 預設設定值太高

檢查 `src/config.ts` 中的預設值：

```typescript
antiSpam: {
  spamThreshold: 7,        // 需要 7 條訊息才觸發（你測試了 5 條）
  timeWindow: 8 * 1000,    // 8 秒內
  // ...
}
```

**解決方案**: 發送至少 7 條訊息，或修改設定。

### 問題 3: 使用者在忽略清單

檢查 `.env` 檔案：

```env
ANTISPAM_IGNORED_USERS=user_id_1,user_id_2
ANTISPAM_IGNORED_ROLES=role_id_1,role_id_2
```

### 問題 4: Redis 未啟用或連線失敗

檢查 `.env`:

```env
REDIS_ENABLED=true
REDIS_URL=redis://localhost:6379
```

確認 Redis 服務正在運行：

```bash
systemctl status redis
# 或
redis-cli ping
```

## 臨時測試方案

如果想快速測試，可以暫時降低閾值：

1. 使用 `/config set` 指令設定較低的閾值：

```
/config set anti_spam_message_threshold 3
/config set anti_spam_time_window 5000
```

2. 或直接修改資料庫：

```sql
INSERT INTO anti_spam_settings (guildid, messagethreshold, time_window, timeoutduration)
VALUES ('1256599582801137764', 3, 5000, 60000)
ON CONFLICT (guildid) DO UPDATE SET
  messagethreshold = 3,
  time_window = 5000,
  timeoutduration = 60000;
```

3. 清除快取：

```bash
redis-cli DEL antiSpamSettings:1256599582801137764
```

## 新增除錯日誌

如果以上都無法找到問題，可以在 `src/features/anti-spam/handler.ts` 中加入更多日誌：

```typescript
export async function handleAntiSpam(message: Message) {
  logger.info(`[Anti-Spam] Processing message from ${message.author.tag} in guild ${message.guild?.id}`);
  
  // ... 現有程式碼 ...
  
  logger.info(`[Anti-Spam] Settings: ${JSON.stringify(settings)}`);
  logger.info(`[Anti-Spam] User data: ${JSON.stringify(userData)}`);
  logger.info(`[Anti-Spam] Spam check result: ${reason || 'No spam detected'}`);
}
```

重新編譯並部署後，再次測試並查看日誌。

## 下一步

執行上述診斷步驟後，將結果回報，我們可以進一步分析問題所在。
