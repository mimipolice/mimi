# 歐狗排行榜模組

## 概述

歐狗排行榜模組已經重構為模組化架構，提供更好的代碼組織、維護性和可擴展性。

## 檔案結構

```
src/features/odog/
├── README.md           # 本說明文件
├── index.js           # 主要入口點
├── config.js          # 配置檔案
├── utils.js           # 工具函數
├── message-handler.js # 訊息處理
├── command-handler.js # 指令處理
├── html-generator.js  # HTML 生成器
├── image-generator.js # 圖片生成器
└── history-fetcher.js # 歷史記錄爬取
```

## 模組說明

### 1. `config.js` - 配置檔案
- 包含所有常數和映射
- 稀有度顏色、圖標配置
- Discord 頻道 ID
- 檔案路徑配置

### 2. `utils.js` - 工具函數
- 數據載入/保存
- 日期處理
- 用戶名提取
- 數據排序

### 3. `message-handler.js` - 訊息處理
- 處理 Discord 訊息
- 自動記錄抽卡數據
- 訊息驗證

### 4. `command-handler.js` - 指令處理
- 處理 `&odog` 指令
- 處理 `&zz` 指令
- 參數解析和回應

### 5. `html-generator.js` - HTML 生成器
- 生成排行榜 HTML
- 卡片式佈局
- 響應式設計
- DaisyUI 樣式

### 6. `image-generator.js` - 圖片生成器
- 使用 Puppeteer 渲染 HTML
- 生成 PNG 圖片
- 錯誤處理

### 7. `history-fetcher.js` - 歷史記錄爬取
- 爬取 Discord 歷史訊息
- 時間範圍過濾
- 批量處理

### 8. `index.js` - 主要入口點
- 統一導出所有功能
- 模組整合

## 使用方式

### 基本使用
```javascript
const odog = require('./odog');

// 處理訊息
await odog.handleOdogMessage(message);

// 處理指令
await odog.handleOdogCommand(message, client);
```

### 單獨使用功能
```javascript
const { generateHTML } = require('./odog/html-generator');
const { loadOdogStats } = require('./odog/utils');

// 載入數據
const stats = loadOdogStats();

// 生成 HTML
const html = generateHTML(stats, "排行榜");
```

## 指令說明

### `&odog` - 顯示排行榜
- `&odog` - 顯示今日排行榜
- `&odog all` - 顯示所有日期排行榜
- `&odog YYYY-MM-DD` - 顯示指定日期排行榜

### `&zz` - 爬取歷史記錄
- `&zz` - 爬取全部歷史記錄
- `&zz 1d` - 爬取今日 12:00 以後記錄
- `&zz 7d` - 爬取過去 7 天記錄

## 開發指南

### 添加新功能
1. 在適當的模組中添加功能
2. 在 `index.js` 中導出新功能
3. 更新本說明文件

### 修改配置
- 編輯 `config.js` 檔案
- 重新啟動應用程式

### 調試
- 每個模組都有獨立的錯誤處理
- 查看控制台日誌進行調試
- 使用 `console.log` 進行開發調試

## 依賴項目

- `puppeteer` - HTML 到圖片轉換
- `fs` - 檔案操作
- `path` - 路徑處理

## 注意事項

1. 確保 `data/temp/` 目錄存在
2. Puppeteer 需要足夠的系統資源
3. 大量歷史記錄爬取可能需要較長時間
4. 圖片生成會創建臨時檔案，會自動清理 