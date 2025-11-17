# 多功能 Discord 輔助機器人

一個功能強大、模組化且易於擴展的 Discord 機器人，旨在提升伺服器管理效率與社群互動體驗。

[![Discord.js](https://img.shields.io/badge/Discord.js-v14.21.0-7289DA?logo=discord&logoColor=white)](https://discord.js.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-v5.8.3-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-≥24.x-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-Cache-DC382D?logo=redis&logoColor=white)](https://redis.io/)

## 📋 目錄

- [專案簡介](#專案簡介)
- [核心功能](#核心功能)
- [技術棧](#技術棧)
- [指令列表](#指令列表)
- [快速開始](#快速開始)
- [功能詳解](#功能詳解)
- [專案架構](#專案架構)
- [如何貢獻](#如何貢獻)

## 專案簡介

此專案是一個多功能、模組化的 Discord 機器人，旨在提供豐富的伺服器管理與社群互動功能。其核心價值在於：

*   **自動化管理**：透過自動化任務（如票務系統、關鍵字回應、反垃圾訊息）來減輕管理員負擔
*   **提升社群互動**：提供互動式指令、資訊查詢和娛樂功能，增加伺服器活躍度
*   **資訊整合**：具備與外部服務（如 OpenAI）和多個資料庫整合的能力，可作為資訊中心
*   **高度可擴展**：模組化設計，易於新增功能和自訂配置

## 核心功能

### 🎫 票務系統 (Ticket System)
完整的客服支援流程，提供專業的使用者服務體驗：
- 多種票務類型支援（可自訂）
- 互動式面板建立（按鈕或下拉選單）
- 工作人員領取與管理票務
- 票務關閉與封存功能
- HTML 格式對話紀錄匯出
- 反垃圾訊息保護機制

### 📚 故事論壇 (Story Forum)
專為創作者與讀者打造的互動平台：
- **作者功能**：
  - 發布 Release（正式版）和 Test（測試版）更新
  - 發送更新通知給訂閱者
  - 權限管理（授權他人發送通知）
  - 訊息釘選功能
- **讀者功能**：
  - 訂閱喜愛的故事
  - 選擇訂閱類型（Release/Test/關注作者）
  - 查看訂閱列表
  - 快速尋找訂閱入口

### 💰 價格追蹤與分析
強大的資產價格監控與分析工具：
- **價格提醒**：
  - 設定價格高於/低於特定值時通知
  - 支援重複提醒或一次性提醒
  - 私訊通知系統
  - DM 驗證機制
- **價格報告**：
  - 動態生成 K 線圖表
  - 智慧調整 K 線週期（1分鐘到3天）
  - 價格走勢分析（開高低收、漲跌幅）
  - 成交量分析
  - 波動率統計
  - 互動式按鈕切換視圖
  - 圖表快取優化

### 🛡️ 自動化管理
減輕管理員負擔的智慧化工具：
- **關鍵字自動回應**：
  - 支援完全符合或包含模式
  - 自訂回覆訊息
  - 頻道特定表情符號自動反應
- **反垃圾訊息系統**：
  - 可配置的偵測閾值
  - 自動禁言處理
  - 豁免身分組設定
  - 申訴管道
  - 詳細日誌記錄

### 🎲 抽卡系統 (Gacha)
娛樂性抽卡功能與排行榜：
- 歐皇榜（Odog Rankings）
- 多卡池支援
- 稀有度統計
- 期間排行（7天/全部）

### 📝 待辦事項 (Todo)
個人任務管理系統：
- 新增/移除待辦事項
- 查看待辦清單
- 一鍵清除所有項目

### 🌐 多語言支援
完整的國際化支援：
- 英文 (en-US)
- 繁體中文 (zh-TW)
- 所有指令與介面均支援雙語

## 技術棧

### 核心技術
*   **語言**: TypeScript 5.8.3
*   **執行環境**: Node.js ≥24.x
*   **框架**: Discord.js 14.21.0

### 資料庫與快取
*   **PostgreSQL** (透過 `pg` 8.16.3)
    - 多資料庫架構（gachaDB、mimiDLCDb）
    - Kysely 0.28.2 提供 Type-safe SQL 查詢
    - 資料庫遷移管理
*   **Redis 5.7.0**
    - 快取層優化效能
    - 設定與資料快取

### 主要函式庫
*   **環境與配置**:
    - `dotenv`: 環境變數管理
*   **日誌與監控**:
    - `winston`: 結構化日誌記錄
    - Discord Webhook 日誌傳輸
*   **圖表與視覺化**:
    - `chart.js` 4.5.0: 圖表生成
    - `canvas` 3.1.2: 圖片渲染
    - `chartjs-adapter-moment`: 時間軸支援
    - `chartjs-plugin-annotation`: 圖表標註
*   **Discord 功能增強**:
    - `discord-html-transcripts`: 聊天紀錄匯出
    - Discord.js Builders: 互動式元件
*   **外部整合**:
    - `openai` 5.10.1: OpenAI API 整合
    - `puppeteer` 24.12.0: 無頭瀏覽器
*   **工具函式庫**:
    - `dayjs` / `date-fns` / `moment`: 日期處理
    - `marked`: Markdown 解析
    - `es-toolkit`: 實用工具函式
    - `p-limit`: 並發控制

### 建置工具
*   TypeScript Compiler
*   `copyfiles`: 資源檔案複製
*   `cross-env`: 跨平台環境變數

## 指令列表

以下是主要的斜線指令列表，詳細用法請使用 `/help` 指令查詢。

### 🔧 管理員指令

| 指令 | 說明 | 權限需求 |
|------|------|----------|
| `/config` | 設定伺服器基本配置（工作人員身分組、頻道等） | Administrator |
| `/config anti-spam` | 設定反垃圾訊息參數（閾值、禁言時長、豁免身分組） | Administrator |
| `/panel setup` | 建立票務面板 | Administrator |
| `/panel add` | 新增票務類型 | Administrator |
| `/panel remove` | 移除票務類型 | Administrator |
| `/panel list` | 列出所有票務類型 | Administrator |
| `/panel customize` | 自訂面板外觀 | Administrator |
| `/ticket` | 管理票務系統 | Administrator |
| `/autoreact set` | 設定頻道自動表情符號反應 | Manage Channels |
| `/autoreact remove` | 移除自動反應 | Manage Channels |
| `/autoreact list` | 列出所有自動反應設定 | Manage Channels |
| `/keyword add` | 新增關鍵字自動回覆 | Administrator |
| `/keyword remove` | 移除關鍵字回覆 | Administrator |
| `/keyword list` | 列出所有關鍵字設定 | Administrator |
| `/fix-ticket` | 修復票務系統問題 | Administrator |
| `?forum story` | 設定故事論壇頻道（前綴指令） | Administrator |

### 👥 公開指令

#### 票務相關
| 指令 | 說明 |
|------|------|
| `/create-ticket` | 建立客服單 |

#### 故事論壇
| 指令 | 說明 |
|------|------|
| `/sf subscribe` | 訂閱故事更新（Release/Test/關注作者） |
| `/sf unsubscribe` | 取消訂閱 |
| `/sf notify` | 發送更新通知（需要權限） |
| `/sf entry` | 創建訂閱入口按鈕 |
| `/sf view` | 查看你的訂閱列表 |
| `/sf find` | 尋找當前討論串的訂閱入口 |
| `/sf permissions add` | 授予推送權限（作者專用） |
| `/sf permissions remove` | 移除推送權限（作者專用） |
| `/sf permissions list` | 查看所有擁有權限的用戶 |
| `?pin` / `?unpin` | 釘選/取消釘選訊息（作者專用，前綴指令） |

#### 價格追蹤
| 指令 | 說明 |
|------|------|
| `/pricealert set` | 設定價格提醒（高於/低於特定價格） |
| `/pricealert list` | 查看你的價格提醒列表 |
| `/pricealert remove` | 移除價格提醒 |
| `/report symbol` | 產生資產價格分析報告（含 K 線圖） |
| `/report list` | 列出所有可用的資產代號 |

#### 其他
| 指令 | 說明 |
|------|------|
| `/odog` | 查看抽卡歐皇榜 |
| `/userinfo` | 查詢使用者資訊 |
| `/ping` | 檢查機器人延遲 |

### 🛠️ 工具指令

| 指令 | 說明 |
|------|------|
| `/help` | 顯示所有可用指令的詳細說明 |
| `/todo add` | 新增待辦事項 |
| `/todo remove` | 移除待辦事項 |
| `/todo list` | 查看待辦清單 |
| `/todo clear` | 清除所有待辦事項 |
| `/permissions` | 查看權限資訊 |

## 快速開始

### 先決條件

*   [Node.js](https://nodejs.org/) ≥24.x
*   [npm](https://www.npmjs.com/) 或其他套件管理工具
*   [PostgreSQL](https://www.postgresql.org/) 資料庫（需要兩個資料庫：gachaDB 和 mimiDLCDb）
*   [Redis](https://redis.io/) 伺服器
*   Discord Bot Token（從 [Discord Developer Portal](https://discord.com/developers/applications) 取得）

### 安裝與設定

#### 1. 複製專案
```bash
git clone https://github.com/956zs/mimi.git
cd mimi
```

#### 2. 安裝依賴
```bash
npm install
```

#### 3. 環境設定
將 `.env.example` 複製為 `.env`：
```bash
cp .env.example .env
```

開啟 `.env` 檔案，填入以下必要的環境變數：

```env
# Discord Bot 設定
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_client_id_here
GUILD_ID=your_guild_id_here  # 用於測試的伺服器 ID

# PostgreSQL 資料庫設定
DB_HOST=localhost
DB_PORT=5432
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME_GACHA=gacha_db
DB_NAME_TICKET=mimi_dlc_db

# Redis 設定
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=  # 如果有設定密碼

# OpenAI API（選填）
OPENAI_API_KEY=your_openai_api_key

# 其他設定
LOG_LEVEL=info
NODE_ENV=production
```

#### 4. 資料庫設定
確保 PostgreSQL 已安裝並執行，然後建立兩個資料庫：
```sql
CREATE DATABASE gacha_db;
CREATE DATABASE mimi_dlc_db;
```

執行資料庫遷移（如果有提供遷移腳本）：
```bash
# 根據專案提供的遷移腳本執行
```

#### 5. Redis 設定
確保 Redis 伺服器正在執行：
```bash
# Linux/macOS
redis-server

# 或使用 Docker
docker run -d -p 6379:6379 redis:latest
```

### 啟動流程

#### 1. 編譯程式碼
```bash
npm run build
```
此命令會：
- 清除舊的 `dist/` 目錄
- 編譯 TypeScript 到 JavaScript
- 複製資源檔案（.sql, .json, .md, .yml, .css）到 `dist/`

#### 2. 部署斜線指令
在首次啟動或新增/修改指令後，需要執行此命令向 Discord 註冊指令：
```bash
npm run deploy
```

#### 3. 啟動機器人

**開發模式**（編譯後直接執行）：
```bash
npm run dev
```

**生產模式**（完整建置後執行）：
```bash
npm run start
```

### 常用指令

```bash
# 建置專案
npm run build

# 啟動機器人（生產模式）
npm run start

# 開發模式
npm run dev

# 部署斜線指令
npm run deploy

# 清理無效的表情符號
npm run clean-emojis
```

### 驗證安裝

1. 機器人成功啟動後，應該會在控制台看到類似以下的訊息：
   ```
   [INFO] Bot is ready! Logged in as YourBotName#1234
   [INFO] Loaded X commands
   [INFO] Connected to PostgreSQL
   [INFO] Connected to Redis
   ```

2. 在 Discord 伺服器中輸入 `/help` 測試機器人是否正常運作

3. 使用 `/ping` 檢查機器人延遲

## 功能詳解

### 票務系統設定流程

1. **基本設定**：使用 `/config set` 設定工作人員身分組、票務類別、日誌頻道等
2. **新增票務類型**：使用 `/panel add` 新增不同類型的客服單
3. **建立面板**：使用 `/panel setup` 在指定頻道建立票務面板
4. **自訂外觀**：使用 `/panel customize` 自訂面板的標題、圖示等

### 故事論壇設定流程

1. **設定論壇頻道**：使用 `?forum story` 指令設定故事論壇頻道
2. **作者發布故事**：在論壇頻道建立討論串
3. **建立訂閱入口**：使用 `/sf entry` 在討論串中建立訂閱按鈕
4. **讀者訂閱**：點擊按鈕或使用 `/sf subscribe` 訂閱
5. **發送更新**：使用 `/sf notify` 通知訂閱者

### 價格追蹤設定

1. **查看可用資產**：使用 `/report list` 查看所有支援的資產
2. **設定提醒**：使用 `/pricealert set` 設定價格提醒條件
3. **查看報告**：使用 `/report symbol` 產生詳細的價格分析報告

### 反垃圾訊息設定

1. **基本設定**：使用 `/config anti-spam set` 設定偵測參數
2. **設定豁免身分組**：在指令中指定不受限制的身分組
3. **查看設定**：使用 `/config anti-spam show` 檢視當前設定
4. **重設**：使用 `/config anti-spam reset` 恢復預設值

## 專案架構

```
src/
├── commands/              # 斜線指令
│   ├── admin/            # 管理員指令
│   ├── public/           # 公開指令
│   └── utility/          # 工具指令
├── events/               # Discord 事件處理器
├── interactions/         # 互動元件處理器
│   ├── buttons/         # 按鈕互動
│   ├── modals/          # 模態框互動
│   └── selectMenus/     # 選單互動
├── services/            # 業務邏輯服務層
├── repositories/        # 資料庫存取層
├── features/            # 功能模組
├── shared/              # 共用模組
│   └── database/        # 資料庫連線與遷移
├── utils/               # 工具函式
├── locales/             # 多語言翻譯檔
├── config/              # 配置檔案
└── types/               # TypeScript 型別定義
```

### 架構特色

- **命令模式**：每個指令獨立模組，易於維護
- **服務層**：業務邏輯與資料存取分離
- **Repository 模式**：統一的資料庫存取介面
- **事件驅動**：基於 Discord.js 的事件系統
- **依賴注入**：服務與資料庫連線透過參數注入
- **模組化載入**：啟動時動態載入所有模組

## 如何貢獻

我們非常歡迎社群的貢獻！無論是回報錯誤、提出功能建議，或是直接提交程式碼，都對專案有極大的幫助。

### 貢獻方式

1. Fork 此專案
2. 建立你的功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交你的變更 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 開啟 Pull Request

### 開發指南

- 遵循 TypeScript 最佳實踐
- 保持程式碼風格一致
- 為新功能撰寫適當的註解
- 測試你的變更
- 更新相關文件

## 授權

本專案採用 MIT 授權條款 - 詳見 [LICENSE](LICENSE) 檔案

## 聯絡方式

如有任何問題或建議，歡迎透過以下方式聯絡：

- 開啟 [Issue](https://github.com/956zs/mimi/issues)
- 提交 [Pull Request](https://github.com/956zs/mimi/pulls)

## 致謝

感謝所有為此專案做出貢獻的開發者和使用者！

---

**注意**：本機器人僅供學習和研究使用，請遵守 Discord 服務條款和相關法律法規。
