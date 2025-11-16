# 多功能 Discord 輔助機器人

一個功能強大、模組化且易於擴展的 Discord 機器人，旨在提升伺服器管理效率與社群互動體驗。

[![Discord.js](https://img.shields.io/badge/Discord.js-v14.21.0-7289DA?logo=discord&logoColor=white)](https://discord.js.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-v5.8.3-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-≥24.x-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)

## 專案簡介

此專案是一個多功能、模組化的 Discord 機器人，旨在提供豐富的伺服器管理與社群互動功能。其核心價值在於：

*   **自動化管理**：透過自動化任務（如票務系統、關鍵字回應、反垃圾訊息）來減輕管理員負擔。
*   **提升社群互動**：提供互動式指令、資訊查詢和娛樂功能，增加伺服器活躍度。
*   **資訊整合**：具備與外部服務（如 OpenAI）和多個資料庫整合的能力，可作為資訊中心。

## 核心功能

*   **票務系統 (`Ticket System`)**: 提供完整的使用者支援票務流程，包括建立、領取、關閉和匯出對話紀錄。
*   **價格提醒 (`Price Alerter`)**: 追蹤並提醒特定資產的價格波動。
*   **故事論壇 (`Story Forum`)**: 作者可發布故事，讀者可訂閱並接收更新通知。支援 Release/Test 不同版本的訂閱類型。
*   **自動化管理 (`Automation`)**:
    *   **自動回應**: 根據關鍵字自動以表情符號或訊息回應。
    *   **反垃圾訊息**: 自動偵測並處理垃圾訊息，並提供申訴管道。
*   **舉報系統 (`Report System`)**: 讓使用者可以輕鬆舉報不當行為，並讓管理員方便地處理舉報。
*   **待辦事項 (`Todo List`)**: 個人任務管理系統。
*   **豐富的斜線指令**: 包含管理、公開、工具等多種類別，支援多國語言（英文、繁體中文）。
*   **圖表生成**: 使用 `Chart.js` 動態生成各種資產價格圖表。
*   **高度可配置**: 透過資料庫與設定檔進行詳細配置。

## 技術棧

*   **語言**: **TypeScript 5.8.3**
*   **框架**: **Discord.js 14.21.0**
*   **資料庫**:
    *   **PostgreSQL** (透過 `pg` 8.16.3)
    *   **Kysely 0.28.2** (Type-safe SQL query builder)
*   **快取**: **Redis**
*   **主要函式庫**:
    *   `dotenv`: 環境變數管理
    *   `winston`: 日誌記錄
    *   `chart.js` / `canvas`: 圖表與圖片生成
    *   `discord-html-transcripts`: 聊天紀錄匯出
    *   `openai`: OpenAI API 整合
    *   `puppeteer`: 無頭瀏覽器，用於網頁抓取或渲染

## 指令列表

以下是主要的斜線指令列表，詳細用法請使用 `/help` 指令查詢。

### 管理員指令

*   `/autoreact`: 設定自動反應。
*   `/config`: 設定機器人各項功能。
*   `/keyword`: 設定關鍵字回覆。
*   `/panel`: 建立互動面板 (例如：工單建立面板)。
*   `/ticket`: 管理工單系統。
*   `/user-info`: 查詢特定使用者資訊。
*   `?forum story`: 設定故事論壇頻道（前綴指令）。

### 公開指令

*   `/ping`: 檢查機器人的延遲。
*   `/pricealert`: 設定價格提醒。
*   `/report`: 產生資產價格報告。
*   `/sf` (Story Forum): 故事論壇訂閱與通知系統。
    *   `/sf subscribe`: 訂閱故事更新。
    *   `/sf unsubscribe`: 取消訂閱。
    *   `/sf notify`: 發送更新通知（作者專用）。
    *   `/sf entry`: 創建訂閱入口。
    *   `/sf view`: 查看訂閱列表。
    *   `/sf permissions`: 管理推送權限。
*   `/userinfo`: 查詢使用者資訊。
*   `?pin` / `?unpin`: 釘選/取消釘選訊息（故事論壇作者專用，前綴指令）。

### 工具指令

*   `/help`: 顯示所有可用指令的說明。
*   `/todo`: 個人待辦事項管理。

## 快速開始

### 先決條件

*   [Node.js](https://nodejs.org/) (建議版本 24.x 或更高)
*   [npm](https://www.npmjs.com/)
*   [PostgreSQL](https://www.postgresql.org/) 資料庫
*   [Redis](https://redis.io/)

### 安裝與設定

1.  **複製專案**
    ```bash
    git clone https://github.com/956zs/mimi.git
    cd mimi
    ```

2.  **安裝依賴**
    ```bash
    npm install
    ```

3.  **環境設定**
    *   將 `.env.example` 複製為 `.env`：
        ```bash
        cp .env.example .env
        ```
    *   開啟 `.env` 檔案，並填入所有必要的環境變數。檔案內的註解會引導您完成設定。

### 啟動流程

1.  **編譯程式碼**
    ```bash
    npm run build
    ```

2.  **部署斜線指令**
    在首次啟動或新增/修改指令後，需要執行此命令來向 Discord 註冊指令。
    ```bash
    npm run deploy
    ```

3.  **啟動機器人**
    *   **開發模式**:
        ```bash
        npm run dev
        ```
    *   **生產模式**:
        ```bash
        npm run start
        ```

## 如何貢獻

我們非常歡迎社群的貢獻！無論是回報錯誤、提出功能建議，或是直接提交程式碼，都對專案有極大的幫助。請參考我們的 [貢獻指南 (CONTRIBUTING.md)](CONTRIBUTING.md) 來了解詳細流程。
