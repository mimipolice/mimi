# 指令: /config

## 簡介
設定或檢視此伺服器的客服單機器人核心參數。

## 語法
```
/config <subcommand> [options]
```

## 參數說明
此指令需要**管理員 (Administrator)** 權限。

### `set` 子指令
一次性設定所有客服單系統必要的頻道與身分組。

| 參數名 | 類型 | 說明 | 是否必需 |
| :--- | :--- | :--- | :--- |
| `staff_role` | Role | 能夠管理與回覆客服單的職員身分組。 | 是 |
| `ticket_category` | Category | 用於建立新客服單頻道的分類。 | 是 |
| `log_channel` | Channel | 用於記錄所有客服單事件 (建立、關閉等) 的頻道。 | 是 |
| `panel_channel` | Channel | 用於發送客服單建立面板的頻道。 | 是 |
| `archive_category` | Category | 用於存放已關閉/封存客服單的分類。 | 是 |

### `view` 子指令
檢視目前伺服器的客服單機器人設定。

| 參數名 | 類型 | 說明 | 是否必需 |
| :--- | :--- | :--- | :--- |
| N/A | N/A | N/A | N/A |

## 回傳值
- **成功**: 指令執行成功後，會回傳一則短暫的 (ephemeral) 確認或資訊訊息。
- **失敗**: 如果發生錯誤，會回傳一則短暫的錯誤訊息。

## 詳細說明
`/config` 指令是客服單系統的基礎。在系統能夠正常運作前，必須使用 `/config set` 指令來完成所有必要設定。此指令確保機器人知道在哪裡建立頻道、記錄日誌、發送面板，以及誰有權限管理客服單。

- **`set`**: 此為初始化設定的關鍵指令。您必須一次提供所有五個選項，以確保系統配置的完整性。
- **`view`**: 方便管理員快速查閱目前的設定值，無需重新設定即可確認所有配置是否正確。

## 使用範例
**設定所有必要參數:**
```
/config set staff_role: @SupportTeam ticket_category: #Tickets log_channel: #ticket-logs panel_channel: #get-help archive_category: #Archived Tickets
```

**檢視目前設定:**
```
/config view
```

## 錯誤處理/例外情況
- **權限不足**: 非管理員使用者嘗試執行此指令。
- **缺少參數**: 在使用 `/config set` 時，未提供所有必要的五個選項。
- **設定不存在**: 在伺服器尚未進行任何設定時，使用 `/config view`。

## 相關條目
- `/panel`