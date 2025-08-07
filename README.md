#  多功能 Discord 輔助機器人

一個功能強大、模組化且易於擴展的 Discord 機器人，旨在提升伺服器管理效率與社群互動體驗。

[![Discord.js](https://img.shields.io/badge/Discord.js-v14.21.0-7289DA?logo=discord&logoColor=white)](https://discord.js.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-v5.9.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-≥24.0.0-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)

## 專案簡介

此專案是一個多功能、模組化的 Discord 機器人，旨在提供豐富的伺服器管理與社群互動功能。其核心價值在於：

*   **自動化管理**：透過自動化任務（如票務系統、關鍵字回應）來減輕管理員負擔。
*   **提升社群互動**：提供互動式指令、資訊查詢和娛樂功能，增加伺服器活躍度。
*   **資訊整合**：具備與外部服務（如 OpenAI）和多個資料庫整合的能力，可作為資訊中心。

## 核心功能

*   **票務系統 (`TicketManager`)**: 完整的使用者支援票務流程。
*   **價格提醒 (`PriceAlerter`)**: 追蹤並提醒特定項目價格。
*   **自動回應 (`autoreact`)**: 根據關鍵字自動以表情符號回應。
*   **豐富的斜線指令**: 包含管理、公開、工具等多種類別。
*   **外部 API 整合**: 如 OpenAI、圖表生成等。
*   **高度可配置**: 透過資料庫與設定檔進行詳細配置。

## 技術棧

*   **語言**: **TypeScript 5.8.3**
*   **框架**: **Discord.js 14.21.0**
*   **資料庫**:
    *   **PostgreSQL** (透過 `pg` 8.16.3)
    *   **Kysely 0.28.2** (Type-safe SQL query builder)
*   **主要函式庫**:
    *   `dotenv`: 環境變數管理
    *   `winston`: 日誌記錄
    *   `chart.js` / `canvas`: 圖表與圖片生成
    *   `discord-html-transcripts`: 聊天紀錄匯出
    *   `openai`: OpenAI API 整合

## 快速開始

### 先決條件

*   [Node.js](https://nodejs.org/) (建議版本 24.x 或更高)
*   [npm](https://www.npmjs.com/)
*   [PostgreSQL](https://www.postgresql.org/) 資料庫

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

1.  **部署斜線指令**
    在首次啟動或新增/修改指令後，需要執行此命令來向 Discord 註冊指令。
    ```bash
    npm run deploy
    ```

2.  **啟動機器人**
    *   **開發模式** (使用 `ts-node-dev` 自動重啟):
        ```bash
        npm run dev
        ```
    *   **生產模式**:
        ```bash
        npm run build
        npm run start
        ```

## 使用範例

*   `/ping`: 檢查機器人的延遲。
*   `/userinfo`: 查詢使用者資訊。
*   `/help`: 顯示所有可用指令的說明。

## 如何貢獻

我們非常歡迎社群的貢獻！無論是回報錯誤、提出功能建議，或是直接提交程式碼，都對專案有極大的幫助。請參考我們的 [貢獻指南 (CONTRIBUTING.md)](CONTRIBUTING.md) 來了解詳細流程。

