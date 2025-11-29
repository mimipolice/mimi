# 專案結構優化計畫

## 目標

將扁平的 `services/` 和 `utils/` 目錄按功能分組，提高可維護性。

---

## 階段 1：Services 分組

### 目標結構
```
src/services/
├── cache/
│   ├── index.ts
│   ├── CacheService.ts
│   ├── ChartCacheService.ts
│   └── CacheInvalidationService.ts
├── discord/
│   ├── index.ts
│   ├── DiscordService.ts
│   ├── LocalizationManager.ts
│   └── HelpService.ts
├── features/
│   ├── index.ts
│   ├── TicketManager.ts
│   ├── PriceAlerter.ts
│   ├── SettingsManager.ts
│   ├── ForumService.ts
│   ├── StoryForumService.ts
│   └── AntiSpamSettingsManager.ts
└── index.ts  (重新導出所有 services)
```

### 步驟

#### 1.1 建立 cache/ 子目錄
- [ ] 建立 `src/services/cache/` 目錄
- [ ] 移動 `CacheService.ts` → `cache/CacheService.ts`
- [ ] 移動 `ChartCacheService.ts` → `cache/ChartCacheService.ts`
- [ ] 移動 `CacheInvalidationService.ts` → `cache/CacheInvalidationService.ts`
- [ ] 更新這 3 個檔案的 import 路徑（`../` → `../../`）
- [ ] 建立 `cache/index.ts` 重新導出
- [ ] 執行 `npx tsc --noEmit` 確認編譯通過
- [ ] 更新所有引用這些檔案的地方

#### 1.2 建立 discord/ 子目錄
- [ ] 建立 `src/services/discord/` 目錄
- [ ] 移動 `DiscordService.ts` → `discord/DiscordService.ts`
- [ ] 移動 `LocalizationManager.ts` → `discord/LocalizationManager.ts`
- [ ] 移動 `HelpService.ts` → `discord/HelpService.ts`
- [ ] 更新這 3 個檔案的 import 路徑
- [ ] 建立 `discord/index.ts` 重新導出
- [ ] 執行 `npx tsc --noEmit` 確認編譯通過
- [ ] 更新所有引用這些檔案的地方

#### 1.3 建立 features/ 子目錄
- [ ] 建立 `src/services/features/` 目錄
- [ ] 移動剩餘 6 個 service 檔案
- [ ] 更新 import 路徑
- [ ] 建立 `features/index.ts` 重新導出
- [ ] 執行 `npx tsc --noEmit` 確認編譯通過
- [ ] 更新所有引用這些檔案的地方

#### 1.4 建立 services/index.ts
- [ ] 建立主 index.ts 重新導出所有子目錄
- [ ] 執行完整編譯測試

---

## 階段 2：Utils 分組

### 目標結構
```
src/utils/
├── core/
│   ├── index.ts
│   ├── logger.ts
│   ├── errorHandler.ts
│   ├── sanitize.ts
│   └── localization.ts
├── discord/
│   ├── index.ts
│   ├── interactionReply.ts
│   ├── replyHelper.ts
│   └── emojiValidator.ts
├── transcript/
│   ├── index.ts
│   ├── transcript.ts
│   ├── transcriptWithOG.ts
│   └── chatTranscript.ts
├── rendering/
│   ├── index.ts
│   ├── chart-generator.ts
│   ├── markdown-to-image.ts
│   └── table-style.css
├── (其他未分類檔案保留在根目錄)
│   ├── baseModal.ts
│   ├── baseView.ts
│   ├── ticketDebug.ts
│   └── discordWebhookTransport.ts
└── index.ts
```

### 步驟

#### 2.1 建立 core/ 子目錄
- [ ] 建立 `src/utils/core/` 目錄
- [ ] 移動 `logger.ts`, `errorHandler.ts`, `sanitize.ts`, `localization.ts`
- [ ] 更新 import 路徑
- [ ] 建立 `core/index.ts`
- [ ] 編譯測試
- [ ] 更新所有引用

#### 2.2 建立 discord/ 子目錄
- [ ] 建立 `src/utils/discord/` 目錄
- [ ] 移動 `interactionReply.ts`, `replyHelper.ts`, `emojiValidator.ts`
- [ ] 更新 import 路徑
- [ ] 建立 `discord/index.ts`
- [ ] 編譯測試
- [ ] 更新所有引用

#### 2.3 建立 transcript/ 子目錄
- [ ] 建立 `src/utils/transcript/` 目錄
- [ ] 移動 3 個 transcript 相關檔案
- [ ] 更新 import 路徑
- [ ] 建立 `transcript/index.ts`
- [ ] 編譯測試
- [ ] 更新所有引用

#### 2.4 建立 rendering/ 子目錄
- [ ] 建立 `src/utils/rendering/` 目錄
- [ ] 移動 `chart-generator.ts`, `markdown-to-image.ts`, `table-style.css`
- [ ] 更新 import 路徑
- [ ] 建立 `rendering/index.ts`
- [ ] 編譯測試
- [ ] 更新所有引用

#### 2.5 建立 utils/index.ts
- [ ] 建立主 index.ts 重新導出所有子目錄和根目錄檔案
- [ ] 執行完整編譯測試

---

## 階段 3：清理與驗證

- [ ] 刪除原本根目錄的舊檔案（確認子目錄版本運作正常後）
- [ ] 執行 `npm run build` 完整編譯
- [ ] 執行 `npm run dev` 測試啟動
- [ ] 更新 `.kiro/steering/structure.md` 文件

---

## 注意事項

1. **每個子步驟後都要編譯測試**，避免累積錯誤
2. **使用 git 追蹤變更**，方便回滾
3. **優先處理依賴較少的模組**（如 cache/）
4. **保持向後相容**：透過 index.ts 重新導出，舊的 import 路徑仍可運作

---

## 預估影響

| 項目 | 需要更新的檔案數 |
|------|-----------------|
| CacheService 引用 | ~15 |
| LocalizationManager 引用 | ~25 |
| logger 引用 | ~50+ |
| transcript 引用 | ~5 |

建議從影響最小的 `transcript/` 開始，逐步擴大範圍。
