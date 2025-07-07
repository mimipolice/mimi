# mimi Discord Stock Bot

## 介紹

`mimi` 是一個基於 `discord.js-selfbot-v13` 的 Discord 股票追蹤與睡眠追蹤機器人，支援自動推播、股票報告、睡眠期間多股票分析等功能。

---

## 功能

- 自動查詢股票並記錄歷史數據
- 股票報告：查詢任意股票的歷史走勢圖與統計
- 歐氣統計：追蹤抽卡 embed 訊息並統計稀有度排行
- 關鍵字自動回覆：設定關鍵字觸發自動回覆
- 自動回應：對指定頻道訊息自動回應 emoji

---

## 指令

### 股票相關
- `&report <股票代碼> [區間]`：查詢指定股票的歷史報告
範例：`&report APPLG 7d`、`&report list`
- `&report list`：顯示所有可查詢股票列表

### 歐氣統計
- `&odog`：查詢今日歐氣排行
- `&odog all`：查詢所有日期總排行
- `&odog <日期>`：查詢指定日期排行
- `&zz`：爬取全部歷史 embed 訊息
- `&zz 1d`：爬取今日 12:00 以後訊息
- `&zz 7d`：爬取過去 7 天訊息

### 關鍵字管理
- `&addkw <關鍵字> <回覆>`：新增關鍵字自動回覆
- `&delkw <關鍵字>`：刪除關鍵字
- `&listkw`：列出所有關鍵字

### 自動回應
- `&ar`：顯示當前自動回應設定
- `&ar <emoji> <channel>`：設定對指定頻道自動回應
- `&ar remove <channelID>`：移除指定頻道的自動回應

**支援格式：**
- `&ar <:frogfire:1390753587444977714> 1372931999701926001`
- `&ar <:frogfire:1390753587444977714> <#1372931999701926001>`
- `&ar 1390753587444977714 <#1372931999701926001>`

### 其他
- `&help`：顯示所有指令說明

---

## 開發指南

### 新增指令

1. **在 `src/features/` 建立新的功能模組**
   ```javascript
   // src/features/newFeature.js
   async function handleNewCommand(message, client) {
     if (!message.content.startsWith("&new")) return false;
     
     // 處理指令邏輯
     message.reply("新功能回應");
     return true;
   }
   
   module.exports = {
     handleNewCommand,
   };
   ```

2. **在 `src/core/index.js` 中引入並註冊**
   ```javascript
   const { handleNewCommand } = require("../features/newFeature");
   
   client.on("messageCreate", async (message) => {
     // 其他指令處理...
     if (await handleNewCommand(message, client)) return;
     // 其他功能...
   });
   ```

### 新增自動回應格式

在 `src/features/autoReact.js` 的 `parseEmojiAndChannel` 函數中新增支援格式：

```javascript
// 新增格式支援
const newFormatMatch = emojiArg.match(/^新的格式正則表達式$/);
if (newFormatMatch) {
  emojiId = newFormatMatch[1];
}
```

### 資料儲存

- **JSON 檔案**：存放在 `data/json/` 目錄
- **設定檔**：存放在 `data/config/` 目錄
- **API 端點**：存放在 `src/web/` 目錄

### 日誌系統

專案使用自定義的 logger 工具，支援計數功能：

```javascript
const { logWithCounter, logDirect } = require("../utils/logger");

// 計數日誌（相同訊息會顯示 x2, x3...）
logWithCounter("已發送 /stock 指令", "📤");

// 直接日誌（會中斷計數並直接輸出）
logDirect("[AUTO REACT] 已對訊息回應");
```

### 環境變數

新增環境變數時，在 `src/core/config.js` 中新增對應的 getter/setter 函數：

```javascript
function getNewConfig() {
  return process.env.NEW_CONFIG || "default_value";
}

module.exports = {
  // 其他 exports...
  getNewConfig,
};
```

---

## 安裝與啟動

1. **安裝依賴**

```sh
npm install
```

2. **設定環境變數**

在專案根目錄建立 `.env` 檔案，內容如下：

```env
TOKEN=你的 Discord Token
STOCK_STORAGE_MODE=both  # 可選：db, json, both
```

3. **啟動機器人**

```sh
# 啟動主程式
npm start

# 或單獨啟動股票監控
npm run stock

# 或直接執行
node src/core/index.js
```

---

## 檔案結構

```
mimi/
├── src/
│   ├── core/           # 核心檔案
│   │   ├── index.js    # 主程式入口
│   │   └── config.js   # 設定檔存取
│   ├── features/       # 功能模組
│   │   ├── autoReact.js# 自動添加反應模組
│   │   ├── commands.js # 指令處理
│   │   ├── stock.js    # 股票資料與推播
│   │   ├── sleep.js    # 資料分析
│   │   └── odog.js     # 歐氣統計功能
│   ├── utils/          # 工具函數
│   │   ├── chart.js    # 圖表繪製
│   │   ├── logger.js   # 日誌工具（帶計數功能）
│   │   └── utils.js    # 通用工具
│   └── web/            # Web 相關
│       ├── api.php     # API 端點
│       └── ...         # 其他 Web 檔案
├── data/
│   ├── json/           # JSON 資料檔案
│   │   ├── allStockData.json
│   │   ├── sleepData.json
│   │   ├── odog_stats.json
│   │   ├── keywords.json
│   │   └── auto_react.json
│   └── config/         # 設定檔案
├── docs/               # 文件
│   ├── README.md
│   └── test/           # 測試檔案
├── package.json
├── .env
└── .gitignore
```

---

## 配置說明

### 股票儲存模式
- `db`：只儲存到資料庫
- `json`：只儲存到 JSON 檔案
- `both`：同時儲存到資料庫和 JSON（預設）

### 環境變數
- `TOKEN`：Discord Bot Token
- `STOCK_STORAGE_MODE`：股票儲存模式（可選：db, json, both）

---

## 注意事項

- 本專案為 selfbot 僅供學術/個人用途，請勿用於違反 Discord 條款之用途。
- 若需自訂頻道、用戶、推播清單，請修改相關設定檔案。
- 股票資料會根據 `STOCK_STORAGE_MODE` 設定儲存到不同位置。

---

## License

MIT
