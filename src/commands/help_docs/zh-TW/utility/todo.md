# 指令: /todo

## 簡介
管理您個人的待辦事項清單。

## 語法
```
/todo <subcommand> [options]
```

## 參數說明

### `add` 子指令
新增一個項目到您的待辦事項清單。

| 參數名 | 類型 | 說明 | 是否必需 |
| :--- | :--- | :--- | :--- |
| `item` | String | 要新增的待辦事項內容。 | 是 |

### `remove` 子指令
從您的待辦事項清單中移除一個項目。

| 參數名 | 類型 | 說明 | 是否必需 |
| :--- | :--- | :--- | :--- |
| `id` | Integer | 要移除的項目的 ID。支援自動完成。 | 是 |

### `list` 子指令
列出您目前所有的待辦事項。

| 參數名 | 類型 | 說明 | 是否必需 |
| :--- | :--- | :--- | :--- |
| N/A | N/A | N/A | N/A |

### `clear` 子指令
清除您所有的待辦事項。

| 參數名 | 類型 | 說明 | 是否必需 |
| :--- | :--- | :--- | :--- |
| N/A | N/A | N/A | N/A |

## 回傳值
- 所有子指令成功執行後，都會回傳一則僅限您本人可見的 (ephemeral) 確認或資訊訊息。
- 若發生錯誤，則回傳一則僅限您本人可見的錯誤訊息。

## 詳細說明
`/todo` 指令提供了一套完整、私人的待辦事項管理功能。您的清單只有您自己看得到，且與其他使用者完全獨立。

- **`add`**: 快速新增一件待辦事項。
- **`remove`**: 透過唯一的項目 ID 來移除已完成或不再需要的項目。此處的 `id` 參數支援自動完成，當您開始輸入時，會顯示您清單中符合的項目，方便您選取並移除。
- **`list`**: 隨時查看您還有哪些未完成的事項。
- **`clear`**: 一次性清空整個清單，適合在完成一個階段性任務後使用。

所有互動都是短暫訊息，不會干擾到公開頻道。

## 使用範例
**新增一個待辦事項:**
```
/todo add item: 完成專案報告
```

**移除 ID 為 3 的待辦事項:**
```
/todo remove id: 3
```

**查看我的待辦清單:**
```
/todo list
```

**清空我的所有待辦事項:**
```
/todo clear
```

## 錯誤處理/例外情況
- **找不到項目**: 在使用 `/todo remove` 時，提供了您清單中不存在的 ID。
- **資料庫錯誤**: 在存取您的待辦事項清單時發生後端錯誤。

## 相關條目
- N/A

---

# Command: /todo

## Summary
Manages your personal to-do list.

## Syntax
```
/todo <subcommand> [options]
```

## Parameters

### `add` Subcommand
Adds an item to your to-do list.

| Parameter | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `item` | String | The content of the to-do item. | Yes |

### `remove` Subcommand
Removes an item from your to-do list.

| Parameter | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `id` | Integer | The ID of the item to remove. Supports autocomplete. | Yes |

### `list` Subcommand
Lists all your current to-do items.

| Parameter | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| N/A | N/A | N/A | N/A |

### `clear` Subcommand
Clears your entire to-do list.

| Parameter | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| N/A | N/A | N/A | N/A |

## Return Value
- On successful execution, all subcommands return an ephemeral (visible only to you) confirmation or informational message.
- If an error occurs, it returns an ephemeral error message.

## Detailed Description
The `/todo` command provides a complete and private to-do list management suite. Your list is visible only to you and is entirely separate from other users' lists.

- **`add`**: Quickly add a new to-do item.
- **`remove`**: Remove completed or unnecessary items via their unique ID. The `id` parameter here supports autocomplete; as you type, it will show matching items from your list, making it easy to select and remove them.
- **`list`**: Check what tasks you still have pending at any time.
- **`clear`**: Wipes the entire list at once, suitable for use after completing a major phase of tasks.

All interactions are ephemeral, ensuring they do not clutter public channels.

## Examples
**To add a to-do item:**
```
/todo add item: Finish the project report
```

**To remove the to-do item with ID 3:**
```
/todo remove id: 3
```

**To view my to-do list:**
```
/todo list
```

**To clear my entire to-do list:**
```
/todo clear
```

## Error Handling/Exceptions
- **Item Not Found**: Providing an ID that does not exist in your list when using `/todo remove`.
- **Database Error**: A backend error occurs while accessing your to-do list.

## See Also
- N/A