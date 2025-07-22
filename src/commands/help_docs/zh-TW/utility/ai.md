# AI 聊天指令

這是一個與 AI 聊天的指令，並且可以管理自訂的 prompt。

## 設定

要使用此指令，您需要在您的 `.env` 檔案中設定以下環境變數：

- `OPENAI_API_KEY`: 您的 OpenAI API 金鑰。
- `OPENAI_API_ENDPOINT`: 您的 OpenAI API 端點。

## 指令

### `/ai chat`

與 AI 聊天。

- **message**: 要傳送給 AI 的訊息。
- **prompt**: (可選) 要使用的自訂 prompt 的名稱。

### `/ai prompt create`

建立一個新的自訂 prompt。

- **name**: prompt 的名稱。
- **prompt**: prompt 的內容。

### `/ai prompt list`

列出所有可用的自訂 prompt。

### `/ai prompt update`

更新一個現有的自訂 prompt。

- **name**: 要更新的 prompt 的名稱。
- **prompt**: 新的 prompt 內容。

### `/ai prompt delete`

刪除一個自訂 prompt。

- **name**: 要刪除的 prompt 的名稱。