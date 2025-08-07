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

### `set` 子指令
設定防洗版參數。

| 參數名 | 類型 | 說明 | 是否必需 |
| :--- | :--- | :--- | :--- |
| `threshold` | Integer | 在時間範圍內，使用者發送多少訊息會觸發偵測。 | 是 |
| `timeout` | Integer | 觸發洗版後，要禁言使用者多久（秒）。 | 是 |
| `time_window` | Integer | 偵測洗版的秒數範圍。 | 是 |

### `show` 子指令
顯示目前的防洗版設定。

### `reset` 子指令
將防洗版設定重設為預設值。

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