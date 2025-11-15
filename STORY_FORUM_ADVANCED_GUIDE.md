# 故事論壇進階訂閱系統 - 完整指南

## 📋 目錄

1. [系統概述](#系統概述)
2. [部署步驟](#部署步驟)
3. [功能說明](#功能說明)
4. [使用教學](#使用教學)
5. [常見問題](#常見問題)
6. [技術細節](#技術細節)

---

## 系統概述

這是一個完整的故事論壇訂閱和通知系統，讓作者可以發布故事並推送更新通知給訂閱者。

### 核心功能

- ✅ **多種訂閱類型**：Release（正式版）、Test（測試版）、關注作者（所有更新）
- ✅ **自動詢問機制**：發帖時自動詢問是否創建訂閱入口
- ✅ **樓層連結推送**：推送時附帶具體更新樓層的連結
- ✅ **權限管理**：最多5人可以推送更新（包括作者）
- ✅ **訂閱入口查看**：即時顯示訂閱狀態和最後更新
- ✅ **Pin/Unpin功能**：作者可以釘選重要訊息

### 系統架構

```
Story Forum Advanced System
├── Database Tables
│   ├── story_forum_threads (故事討論串)
│   ├── story_forum_subscriptions (訂閱記錄)
│   ├── story_forum_subscription_entries (訂閱入口)
│   ├── story_forum_permissions (推送權限)
│   └── story_forum_author_preferences (作者偏好)
├── Commands
│   └── /sf (story-forum)
│       ├── 訂閱 (subscribe)
│       ├── 取消訂閱 (unsubscribe)
│       ├── 推送更新 (notify)
│       ├── 創建入口 (entry)
│       ├── 查看入口 (view)
│       └── 管理權限 (permissions)
├── Prefix Commands
│   ├── ?pin (釘選訊息)
│   └── ?unpin (取消釘選)
└── Auto Interactions
    └── 發帖時自動詢問創建訂閱入口
```

---

## 部署步驟

### 1. 資料庫遷移

#### 方法 A：使用 SQL 腳本（推薦）

```bash
# 執行資料庫遷移
psql -h <host> -U <user> -d <database> -f migrations/002_advanced_story_subscriptions.sql
```

#### 方法 B：使用 TypeScript 腳本

```bash
# 確保環境變數已設定
export MIMIDLC_DB_HOST=your_host
export MIMIDLC_DB_USER=your_user
export MIMIDLC_DB_PASSWORD=your_password
export MIMIDLC_DB_NAME=your_database

# 編譯並執行
npm run build
node dist/scripts/create-story-subscriptions-table.js
```

### 2. 部署 Guild Commands

```bash
# 重新部署指令
npm run deploy
```

### 3. 重啟 Bot

```bash
# 重啟服務
npm run start
```

### 4. 驗證部署

1. 在故事論壇頻道發布測試帖子
2. 確認收到「是否要創建更新推流功能」的提示
3. 測試 `/sf` 指令的所有子指令

---

## 功能說明

### 訂閱類型

| 類型 | 說明 | 適用場景 |
|------|------|----------|
| **Release** | 正式版更新 | 穩定版本、正式章節 |
| **Test** | 測試版更新 | 測試內容、預覽版本 |
| **關注作者** | 所有更新 | 想接收作者所有通知的讀者 |

### 指令清單

#### `/sf 訂閱 <類型>`
訂閱指定類型的更新通知。

**參數：**
- `類型`：Release / Test / 關注作者

**示例：**
```
/sf 訂閱 Release
/sf 訂閱 Test
/sf 訂閱 關注作者
```

#### `/sf 取消訂閱 [類型]`
取消訂閱指定類型或全部訂閱。

**參數：**
- `類型`（選填）：Release / Test / 關注作者 / 全部取消

**示例：**
```
/sf 取消訂閱          # 取消所有訂閱
/sf 取消訂閱 Release  # 只取消 Release
```

#### `/sf 推送更新 <類型> <連結> [說明]`
發送更新通知給訂閱者（需要權限）。

**參數：**
- `類型`：Release / Test
- `連結`：更新樓層的訊息連結
- `說明`（選填）：簡短說明，最多400字

**如何取得訊息連結：**
- **電腦**：右鍵點擊訊息 → 複製訊息連結
- **手機**：長按訊息 → 複製訊息連結

**示例：**
```
/sf 推送更新 Release https://discord.com/channels/.../... 新增第3章
/sf 推送更新 Test https://discord.com/channels/.../... 測試版：修正錯字
```

#### `/sf 創建入口`
為當前帖子創建訂閱入口（僅作者）。

#### `/sf 查看入口`
查看當前帖子的訂閱入口和狀態。

顯示內容：
- 各類型訂閱人數
- 用戶的訂閱狀態
- 最後更新連結

#### `/sf 管理權限`
查看和管理推送權限（僅作者）。

**權限規則：**
- 最多5人（包括作者）
- 作者可以授權其他人推送更新
- 授權用戶可以使用「推送更新」功能

#### 前綴指令

**`?pin`** - 釘選訊息（僅作者）
```
?pin
```
在任意訊息下方回覆此指令即可釘選該訊息。

**`?unpin`** - 取消釘選（僅作者）
```
?unpin
```
在已釘選的訊息下方回覆此指令即可取消釘選。

---

## 使用教學

### 作為作者

#### 1. 發布新帖

1. 在故事論壇頻道創建新帖子
2. Bot 會自動詢問是否創建「更新推流」功能
3. 選擇：
   - **是**：立即創建訂閱入口
   - **否**：這次不創建，下次還會問
   - **不再提醒**：以後都不問

#### 2. 手動創建訂閱入口

如果之前選擇「否」或「不再提醒」，可以隨時手動創建：

```
/sf 創建入口
```

#### 3. 推送更新通知

當你更新內容後：

1. 複製更新樓層的訊息連結
2. 使用指令推送：
   ```
   /sf 推送更新 Release <連結> 新增第5章
   ```

3. 所有訂閱者會收到通知（包含你的 @ 提及）

#### 4. 釘選重要訊息

在重要訊息下回覆：
```
?pin
```

取消釘選：
```
?unpin
```

#### 5. 授權其他人推送（未來功能）

```
/sf 管理權限
```

目前顯示權限列表，未來會添加授權/撤銷功能。

### 作為讀者

#### 1. 查看訂閱入口

```
/sf 查看入口
```

會顯示：
- 各類型訂閱人數
- 你的訂閱狀態
- 最後更新連結

#### 2. 訂閱更新

```
/sf 訂閱 Release     # 訂閱正式版
/sf 訂閱 Test        # 訂閱測試版
/sf 訂閱 關注作者     # 訂閱所有更新
```

#### 3. 取消訂閱

```
/sf 取消訂閱 Release  # 取消特定類型
/sf 取消訂閱          # 取消所有訂閱
```

#### 4. 接收通知

當作者推送更新時，你會收到：
- @ 提及通知
- 更新類型（🎉 Release / 🧪 Test）
- 更新內容連結
- 作者的簡短說明（如果有）

---

## 常見問題

### Q: 如何恢復「發帖時詢問」功能？

A: 目前需要聯繫管理員手動修改資料庫。未來會添加設定指令。

### Q: 可以同時訂閱多種類型嗎？

A: 可以！你可以同時訂閱 Release、Test 和關注作者。

### Q: 「關注作者」和其他類型有什麼區別？

A: 
- Release/Test：只接收特定類型的更新
- 關注作者：接收該作者的所有更新通知（包括 Release 和 Test）

### Q: 推送更新需要什麼權限？

A: 
- 作者自動擁有權限
- 作者可以授權最多4位其他用戶（總共5人）
- 權限管理功能待實現

### Q: 訊息連結格式不正確怎麼辦？

A: 確保連結格式為：
```
https://discord.com/channels/伺服器ID/頻道ID/訊息ID
```

### Q: 為什麼我看不到訂閱入口？

A: 可能原因：
1. 作者尚未創建訂閱入口
2. 帖子尚未通過驗證
3. 使用 `/sf 查看入口` 檢查狀態

### Q: 可以批量取消訂閱嗎？

A: 使用 `/sf 取消訂閱` 不指定類型即可取消所有訂閱。

---

## 技術細節

### 資料庫結構

#### story_forum_subscriptions
```sql
CREATE TABLE story_forum_subscriptions (
  id SERIAL PRIMARY KEY,
  thread_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  subscription_type VARCHAR(20) NOT NULL,  -- 'release', 'test', 'author_all'
  subscribed_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(thread_id, user_id, subscription_type)
);
```

#### story_forum_subscription_entries
```sql
CREATE TABLE story_forum_subscription_entries (
  thread_id VARCHAR(255) PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  last_release_update VARCHAR(255),
  last_test_update VARCHAR(255)
);
```

#### story_forum_permissions
```sql
CREATE TABLE story_forum_permissions (
  id SERIAL PRIMARY KEY,
  thread_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  granted_at TIMESTAMP DEFAULT NOW(),
  granted_by VARCHAR(255) NOT NULL,
  UNIQUE(thread_id, user_id)
);
```

#### story_forum_author_preferences
```sql
CREATE TABLE story_forum_author_preferences (
  user_id VARCHAR(255) PRIMARY KEY,
  ask_on_post BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### API 端點

#### StoryForumService 主要方法

**訂閱管理：**
- `subscribeToThread(threadId, userId, type)` - 訂閱
- `unsubscribeFromThread(threadId, userId, type?)` - 取消訂閱
- `getUserSubscriptions(threadId, userId)` - 取得用戶訂閱
- `isUserSubscribed(threadId, userId, type?)` - 檢查訂閱狀態

**通知系統：**
- `notifySubscribers(thread, authorId, type, link, desc?)` - 推送通知
- `getThreadSubscribers(threadId, type?)` - 取得訂閱者
- `getSubscriberCount(threadId, type?)` - 取得訂閱數

**訂閱入口：**
- `createSubscriptionEntry(threadId)` - 創建入口
- `hasSubscriptionEntry(threadId)` - 檢查入口
- `getSubscriptionEntry(threadId)` - 取得入口資訊

**權限管理：**
- `addPermission(threadId, userId, grantedBy)` - 添加權限
- `removePermission(threadId, userId)` - 移除權限
- `hasPermission(threadId, userId)` - 檢查權限
- `getPermissions(threadId)` - 取得權限列表

**作者偏好：**
- `getAuthorPreference(userId)` - 取得偏好
- `setAuthorPreference(userId, askOnPost)` - 設定偏好
- `askAboutSubscriptionEntry(thread, authorId)` - 詢問創建入口

### 事件流程

#### 發帖流程
```
1. 用戶在故事論壇創建帖子
   ↓
2. threadCreate 事件觸發
   ↓
3. registerThread() 註冊帖子（格式驗證）
   ↓
4. 檢查作者偏好 getAuthorPreference()
   ↓
5. 如果 ask_on_post = true
   ↓
6. askAboutSubscriptionEntry() 顯示詢問提示
   ↓
7. 用戶點擊按鈕：
   - 是 → createSubscriptionEntry()
   - 否 → 不創建，保持偏好
   - 不再提醒 → setAuthorPreference(false)
```

#### 推送流程
```
1. 作者使用 /sf 推送更新
   ↓
2. hasPermission() 檢查權限
   ↓
3. 驗證訊息連結格式
   ↓
4. getThreadSubscribers() 取得訂閱者
   - 指定類型的訂閱者
   - + 關注作者的訂閱者
   ↓
5. 過濾掉作者本人
   ↓
6. 發送通知訊息（含 @ 提及）
   ↓
7. updateLastUpdate() 更新最後更新連結
```

---

## 更新日誌

### v2.0.0 (2024-01-15)
- ✨ 新增多種訂閱類型（Release/Test/關注作者）
- ✨ 新增發帖時自動詢問機制
- ✨ 新增樓層連結推送功能
- ✨ 新增權限管理系統
- ✨ 新增訂閱入口查看功能
- ✨ 新增作者偏好設定
- 🔧 優化訂閱系統架構
- 📝 完善使用文檔

### v1.0.0 (2024-01-10)
- ✨ 基本訂閱和通知功能
- ✨ Pin/Unpin 前綴指令
- ✨ 故事格式驗證系統

---

## 許可證

本系統是 Mimi Discord Bot 的一部分，遵循專案的開源許可證。

## 支援

如有問題或建議，請：
1. 查看本文檔的「常見問題」部分
2. 在 GitHub 提交 Issue
3. 聯繫開發團隊

---

**最後更新：** 2024-01-15
**版本：** 2.0.0
**維護者：** Roo (Claude)
