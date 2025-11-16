## 簡介
設定或檢視此伺服器的各項功能，包含客服單系統與防洗版功能。

## 語法
```
/config <subcommand_group> <subcommand> [options]
```

## 權限
此指令需要**管理員 (Administrator)** 權限。

---

## 客服單設定

### `set` 子指令
一次性設定所有客服單系統必要的頻道與身分組。

| 參數名 | 類型 | 說明 | 是否必需 |
| :--- | :--- | :--- | :--- |
| `staff_role` | Role | 能夠管理與回覆客服單的職員身分組。 | 是 |
| `ticket_category` | Category | 用於建立新客服單頻道的分類。 | 是 |
| `log_channel` | Channel | 用於記錄所有客服單事件 (建立、關閉等) 的頻道。 | 是 |
| `panel_channel` | Channel | 用於發送客服單建立面板的頻道。 | 是 |
| `archive_category` | Category | 用於存放已關閉/封存客服單的分類。 | 是 |
| `anti_spam_log_channel` | Channel | 用於記錄防洗版事件的頻道。 | 否 |

### `view` 子指令
檢視目前伺服器的客服單機器人設定。

---

## 防洗版設定 (`/config anti-spam`)

防洗版系統會自動偵測並處理洗版行為，保護您的伺服器。

### 運作方式
- **單頻道偵測**：當使用者在單一頻道發送過多訊息時觸發
- **跨頻道偵測**：當使用者在多個頻道快速發送訊息時觸發
- **自動禁言**：違規者會被自動禁言
- **申訴系統**：使用者可透過私訊申訴誤判
- **管理員通知**：詳細的記錄會發送到設定的頻道

### `set` 子指令
設定防洗版偵測參數。

| 參數名 | 類型 | 說明 | 是否必需 | 預設值 |
| :--- | :--- | :--- | :--- | :--- |
| `threshold` | Integer | 單一頻道內觸發偵測的訊息數量 | 是 | 7 |
| `timeout` | Integer | 禁言時長（秒），例如 86400 = 24 小時 | 是 | 86400 |
| `time_window` | Integer | 單頻道偵測的時間範圍（秒） | 是 | 8 |
| `multi_channel_threshold` | Integer | 觸發跨頻道偵測的頻道數量 | 否 | 6 |
| `multi_channel_window` | Integer | 跨頻道偵測的時間範圍（秒） | 否 | 12 |

**注意**：系統只儲存訊息元數據（時間戳記、頻道 ID），不會儲存訊息內容。

### `show` 子指令
顯示目前的防洗版設定與偵測規則。

### `reset` 子指令
將防洗版設定重設為預設值。

### 設定記錄頻道
設定防洗版通知要發送到哪個頻道：
```
/config set anti_spam_log_channel: #spam-logs
```

詳細文件請參閱：[防洗版系統指南](https://github.com/956zs/mimi/blob/main/docs/features/anti-spam.md)

## 使用範例
**設定客服單系統:**
```
/config set staff_role: @SupportTeam ticket_category: #Tickets log_channel: #ticket-logs panel_channel: #get-help archive_category: #Archived Tickets
```

**設定防洗版功能:**
```
/config anti-spam set threshold: 5 timeout: 60 time_window: 10
```

**檢視所有設定:**
```
/config view
/config anti-spam show
```
