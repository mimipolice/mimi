# 故事論壇系統 - 代碼審查報告

## 審查日期
2025-11-15

## 審查範圍
- 訂閱通知系統
- 權限管理系統
- 自動詢問機制
- ?pin 指令處理

---

## ⚠️ 發現的問題

### 1. **嚴重問題** - `?pin` 指令實作不完整

**位置：** [`src/events/handlers/storyForumCommandHandler.ts`](src/events/handlers/storyForumCommandHandler.ts:35-42)

**問題描述：**
當前實作要求使用者「回覆訊息」來使用 `?pin`，但文檔中描述的是使用「訊息連結」作為參數。

**當前實作：**
```typescript
if (!message.reference || !message.reference.messageId) {
  await message.reply("❌ 請回覆您想操作的訊息來使用此指令。");
  return true;
}
```

**文檔描述：**
```
?pin <訊息連結>
```

**影響：** 功能與文檔不一致，使用者困惑

**建議修正：**
1. 修改實作以支援訊息連結參數
2. 或修改所有文檔以匹配當前「回覆訊息」的實作方式

---

### 2. **中等問題** - 權限檢查不完整

**位置：** [`src/events/handlers/storyForumCommandHandler.ts`](src/events/handlers/storyForumCommandHandler.ts:29-33)

**問題描述：**
`?pin` 和 `?unpin` 指令只檢查是否為作者，沒有檢查授權使用者。

**當前實作：**
```typescript
if (message.author.id !== threadInfo.author_id) {
  await message.reply("❌ 只有貼文作者才能使用此指令。");
  return true;
}
```

**問題：** 即使作者透過 `/sf permissions add` 授權了協作者，協作者仍無法使用 `?pin`/`?unpin`

**建議修正：**
```typescript
const hasPermission = await services.storyForumService.hasPermission(
  message.channel.id,
  message.author.id
);

if (!hasPermission) {
  await message.reply("❌ 只有貼文作者或授權使用者才能使用此指令。");
  return true;
}
```

---

### 3. **中等問題** - 自動詢問可能重複觸發

**位置：** 
- [`src/services/StoryForumService.ts:32-39`](src/services/StoryForumService.ts:32-39)
- [`src/events/threadCreate.ts:38-58`](src/events/threadCreate.ts:38-58)

**問題描述：**
自動詢問邏輯在兩個地方都有實作，可能導致重複詢問。

**StoryForumService.registerThread():**
```typescript
setTimeout(async () => {
  if (thread.ownerId) {
    const askOnPost = await this.getAuthorPreference(thread.ownerId);
    if (askOnPost) {
      await this.askAboutSubscriptionEntry(thread, thread.ownerId);
    }
  }
}, 2000);
```

**threadCreate 事件：**
```typescript
setTimeout(async () => {
  try {
    await services.storyForumService.askAboutSubscriptionEntry(
      thread,
      thread.ownerId!
    );
  } catch (error) {
    // ...
  }
}, 3000);
```

**影響：** 可能會發送兩次詢問訊息（一次 2 秒後，一次 3 秒後）

**建議修正：** 移除 `registerThread()` 中的自動詢問邏輯，只在 `threadCreate` 事件中處理

---

### 4. **輕微問題** - 訂閱類型參數在 subscribe 指令中設為必填

**位置：** [`src/commands/public/story/index.ts:40`](src/commands/public/story/index.ts:40)

**問題描述：**
```typescript
.setRequired(true)
```

**問題：** 
- 文檔中說明 `type` 參數是可選的，預設為 `release`
- 但實作中設為必填

**影響：** 使用者必須每次都選擇類型，無法使用預設值

**建議修正：**
```typescript
.setRequired(false)
```

並在 handler 中處理預設值：
```typescript
const type = interaction.options.getString("type") || "release";
```

---

### 5. **輕微問題** - 訂閱入口按鈕文字不明確

**位置：** [`src/interactions/buttons/storyEntryPrompt.ts:38-42`](src/interactions/buttons/storyEntryPrompt.ts:38-42)

**問題描述：**
成功訊息中提到的指令與實際指令名稱不符：
```typescript
"讀者現在可以使用 `/sf 訂閱` 來訂閱你的更新。\n" +
"當你發布新內容後，使用 `/sf 推送更新` 來通知所有訂閱者。\n\n" +
"**提示：**\n" +
"• 使用 `/sf 查看入口` 可以查看目前的訂閱狀態\n" +
"• 使用 `/sf 管理權限` 可以授權其他人推送更新（最多5人）"
```

**實際指令：**
- `/sf subscribe` 而非 `/sf 訂閱`
- `/sf notify` 而非 `/sf 推送更新`
- `/sf entry` 而非 `/sf 創建入口`
- `/sf permissions` 而非 `/sf 管理權限`

**影響：** 使用者可能無法找到正確的指令

**建議修正：** 使用正確的英文指令名稱

---

### 6. **輕微問題** - 錯誤的 embed 結構

**位置：** [`src/services/StoryForumService.ts:561-584`](src/services/StoryForumService.ts:561-584)

**問題描述：**
使用 `ActionRowBuilder` 作為變數名稱 `embed`，但實際上是 `components`：

```typescript
const embed = new ActionRowBuilder<ButtonBuilder>().addComponents(
  // ...
);

await thread.send({
  content: `<@${authorId}>`,
  embeds: [messageContent],  // messageContent 是物件，不是 EmbedBuilder
  components: [embed],
});
```

**問題：**
1. `messageContent` 是普通物件，應該使用 `EmbedBuilder`
2. 變數命名混淆

**建議修正：**
```typescript
import { EmbedBuilder } from "discord.js";

const embed = new EmbedBuilder()
  .setTitle("📢 是否要創建「更新推流」功能？")
  .setDescription("...")
  .setColor(0x5865f2)
  .setFooter({ text: "提示：如果你不確定，可以選「否」，之後再決定" });

const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
  // ...
);

await thread.send({
  content: `<@${authorId}>`,
  embeds: [embed],
  components: [buttons],
});
```

---

### 7. **輕微問題** - unsubscribe 指令的選項命名不一致

**位置：** [`src/commands/public/story/index.ts:70`](src/commands/public/story/index.ts:70)

**問題描述：**
unsubscribe 有一個 "全部取消" 的選項，值為 `"all"`，但這與訂閱類型 `"release"`、`"test"`、`"author_all"` 不一致。

**潛在問題：**
如果 handler 沒有特別處理 `"all"` 值，可能會導致刪除失敗。

**建議：** 在 handler 中確認有正確處理 `type === "all"` 的情況

---

## ✅ 優點

1. **模組化設計良好**
   - 每個 subcommand 都有獨立的 handler
   - Service 層職責清晰

2. **錯誤處理完善**
   - 大部分關鍵操作都有 try-catch
   - 錯誤訊息清楚

3. **權限系統設計合理**
   - 5 人上限明確
   - 作者永久擁有權限

4. **資料庫操作安全**
   - 使用 Kysely 的類型安全查詢
   - 適當使用 `onConflict`

---

## 🔧 建議修正優先級

### P0（必須修正）
1. **修正 ?pin 指令實作與文檔不一致**
   - 選擇一種方式（回覆訊息 OR 訊息連結）
   - 統一更新代碼和文檔

2. **修正自動詢問重複觸發**
   - 移除 `registerThread()` 中的詢問邏輯

### P1（應該修正）
3. **為 ?pin 加入權限檢查**
   - 允許授權使用者使用

4. **修正 subscribe 的 type 參數**
   - 改為 optional，預設 release

5. **修正按鈕回應訊息中的指令名稱**
   - 使用正確的英文指令

### P2（建議修正）
6. **修正 embed 結構**
   - 使用 EmbedBuilder
   - 改善變數命名

---

## 📋 測試建議

### 功能測試
1. **訂閱流程**
   - [ ] 測試三種訂閱類型
   - [ ] 測試重複訂閱（應該被 onConflict 處理）
   - [ ] 測試取消訂閱

2. **通知功能**
   - [ ] 測試 Release 通知
   - [ ] 測試 Test 通知
   - [ ] 確認作者不會被通知到
   - [ ] 確認 author_all 訂閱者會收到兩種通知

3. **權限管理**
   - [ ] 測試添加權限（最多 5 人）
   - [ ] 測試移除權限
   - [ ] 測試授權使用者能否使用 `/sf notify`
   - [ ] 測試授權使用者能否使用 `?pin`（目前不行）

4. **自動詢問**
   - [ ] 測試首次發文會詢問
   - [ ] 測試選擇「是」會創建入口
   - [ ] 測試選擇「否」下次仍會詢問
   - [ ] 測試選擇「不再提醒」後不會再詢問
   - [ ] **檢查是否會重複詢問（重要）**

5. **?pin 指令**
   - [ ] 測試作者使用
   - [ ] 測試非作者使用（應該被拒絕）
   - [ ] 測試授權使用者使用（目前會被拒絕）

### 邊界測試
- [ ] 在非故事論壇討論串使用指令
- [ ] 訂閱不存在的討論串
- [ ] 使用無效的訊息連結
- [ ] 權限超過 5 人限制
- [ ] 超長的 description（應該被限制在 400 字）

---

## 總結

整體代碼品質良好，主要問題集中在：
1. **文檔與實作不一致**（?pin 指令）
2. **重複邏輯**（自動詢問）
3. **權限檢查不完整**（?pin 沒檢查授權使用者）

建議優先修正 P0 和 P1 級別的問題後再部署。
