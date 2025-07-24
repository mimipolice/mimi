# 貢獻指南

非常感謝您有興趣為本專案做出貢獻！我們歡迎任何形式的貢獻，從回報錯誤、提出功能建議到提交程式碼。為了確保協作過程順利，請您花幾分鐘閱讀以下指南。

## 貢獻哲學與行為準則

*   **開放與尊重**: 我們致力於營造一個開放、友善且互相尊重的社群環境。請遵守 [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/)。
*   **溝通**: 在進行較大的改動前，建議先建立一個 Issue 來討論您的想法。這有助於避免重複工作並確保您的貢獻方向與專案目標一致。
*   **品質**: 提交的程式碼應清晰、可讀且經過測試。

## 開發環境設置

請參考主專案 `README.md` 中的「快速開始」一節來設定您的本地開發環境。主要步驟包括：

1.  Fork 本專案至您的 GitHub 帳號。
2.  Clone 您 Fork 的專案至本地。
    ```bash
    git clone https://github.com/956zs/mimi.git
    ```
3.  安裝專案依賴。
    ```bash
    npm install
    ```
4.  建立並設定您的 `.env` 檔案。
5.  執行 `npm run dev` 啟動開發伺服器。

## 分支策略與 Pull Request 流程

我們採用基於功能分支的 Git 工作流程。

1.  **建立分支**: 從 `main` 分支建立一個新的功能分支。分支名稱應簡潔明瞭地描述其目的，建議使用 `feature/`、`fix/` 或 `docs/` 等前綴。
    ```bash
    # 範例：開發新功能
    git checkout -b feature/new-awesome-command

    # 範例：修復錯誤
    git checkout -b fix/ticket-system-bug
    ```

2.  **進行開發**: 在您的分支上進行程式碼修改。

3.  **提交變更**:
    *   確保您的提交訊息清晰明瞭，描述您做了什麼以及為什麼。
    *   我們遵循 [Conventional Commits](https://www.conventionalcommits.org/) 規範。
    *   範例：
        ```
        feat: add user profile command
        fix: resolve issue with ticket closing logic
        docs: update README with new setup instructions
        ```

4.  **保持同步**: 定期將上游 (upstream) `main` 分支的變更同步到您的功能分支。
    ```bash
    git remote add upstream https://github.com/ORIGINAL_OWNER/ORIGINAL_REPO.git
    git fetch upstream
    git rebase upstream/main
    ```

5.  **發起 Pull Request (PR)**:
    *   將您的功能分支推送到您 Fork 的遠端倉庫。
    *   在 GitHub 上，從您的功能分支向原始專案的 `main` 分支發起一個 Pull Request。
    *   在 PR 的描述中，請清楚說明此 PR 的目的、解決了什麼問題，並連結相關的 Issue (如果有的話)。
    *   確保您的 PR 已準備好被審查，並且通過了所有自動化檢查。

## 編碼風格

*   **語言**: **TypeScript**。
*   **格式化**: 我們使用 [Prettier](https://prettier.io/) 來統一程式碼風格。在提交前，請確保您的程式碼已經過格式化。
*   **命名**:
    *   變數與函式使用 `camelCase`。
    *   類別與介面使用 `PascalCase`。
    *   檔案名稱使用 `kebab-case` 或 `camelCase`，請參考現有檔案結構。
*   **註解**: 對於複雜的邏輯，請添加適當的註解以利他人理解。