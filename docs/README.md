# mimi Discord Stock Bot

## 介紹

`mimi` 是一個基於 `discord.js-selfbot-v13` 的 Discord 股票追蹤與睡眠追蹤機器人，支援自動推播、股票報告、睡眠期間多股票分析等功能。

---

## 功能

- 自動查詢股票並記錄歷史數據
- 睡眠追蹤：自動記錄睡眠期間所有股票價格，結束後生成圖表與統計報告
- 股票報告：查詢任意股票的歷史走勢圖與統計
- 自動推播：可針對特定股票開啟/關閉自動價格提醒
- 歐氣統計：追蹤抽卡 embed 訊息並統計稀有度排行
- 欠款管理：記錄和查詢欠款，支援定時提醒
- 關鍵字自動回覆：設定關鍵字觸發自動回覆
- 自動回應：對指定頻道訊息自動回應 emoji

---

## 指令

### 股票相關
- `&ST`：開始/結束睡眠追蹤，結束時自動生成多股票分析報告
- `&report <股票代碼>`：查詢指定股票的歷史報告
- `&report list`：顯示所有可查詢股票列表
- `&note <股票代碼>`：切換該股票自動推播（開/關）

### 歐氣統計
- `&odog`：查詢今日歐氣排行
- `&odog all`：查詢所有日期總排行
- `&odog <日期>`：查詢指定日期排行
- `&zz`：爬取全部歷史 embed 訊息
- `&zz 1d`：爬取今日 12:00 以後訊息
- `&zz 7d`：爬取過去 7 天訊息

### 欠款管理
- `&ad <金額> [ID]`：記錄欠款
- `&ad`：查詢自己所有欠款
- `&ad setchannel <頻道ID>`：設定欠款提醒頻道

### 關鍵字管理
- `&addkw <關鍵字> <回覆>`：新增關鍵字自動回覆
- `&delkw <關鍵字>`：刪除關鍵字
- `&listkw`：列出所有關鍵字

### 自動回應
- `&ar <emojiID> <channelID>`：設定對指定頻道自動回應
- `&ar`：顯示當前自動回應設定
- `&ar remove <channelID>`：移除指定頻道的自動回應

### 其他
- `&config`：查詢目前設定

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
│   │   ├── commands.js # 指令處理
│   │   ├── stock.js    # 股票資料與推播
│   │   ├── sleep.js    # 睡眠追蹤與分析
│   │   └── odog.js     # 歐氣統計功能
│   ├── utils/          # 工具函數
│   │   ├── chart.js    # 圖表繪製
│   │   └── utils.js    # 通用工具
│   └── web/            # Web 相關
│       ├── api.php     # API 端點
│       └── ...         # 其他 Web 檔案
├── data/
│   ├── json/           # JSON 資料檔案
│   │   ├── allStockData.json
│   │   ├── sleepData.json
│   │   ├── odog_stats.json
│   │   ├── debts.json
│   │   ├── keywords.json
│   │   └── auto_react.json
│   └── config/         # 設定檔案
│       └── bot_config.json
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
- `STOCK_STORAGE_MODE`：股票儲存模式
- `DEBT_CHANNEL_ID`：欠款提醒頻道 ID

---

## 注意事項

- 本專案為 selfbot 僅供學術/個人用途，請勿用於違反 Discord 條款之用途。
- 若需自訂頻道、用戶、推播清單，請修改相關設定檔案。
- 股票資料會根據 `STOCK_STORAGE_MODE` 設定儲存到不同位置。

---

## License

MIT
