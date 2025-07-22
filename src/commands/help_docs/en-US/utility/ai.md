# AI Chat Command

This command allows you to chat with an AI and manage custom prompts.

## Setup

To use this command, you need to set the following environment variables in your `.env` file:

- `OPENAI_API_KEY`: Your OpenAI API key.
- `OPENAI_API_ENDPOINT`: Your OpenAI API endpoint.

## Commands

### `/ai chat`

Chat with the AI.

- **message**: The message to send to the AI.
- **prompt**: (Optional) The name of the custom prompt to use.

### `/ai prompt create`

Create a new custom prompt.

- **name**: The name of the prompt.
- **prompt**: The content of the prompt.

### `/ai prompt list`

List all available custom prompts.

### `/ai prompt update`

Update an existing custom prompt.

- **name**: The name of the prompt to update.
- **prompt**: The new content of the prompt.

### `/ai prompt delete`

Delete a custom prompt.

- **name**: The name of the prompt to delete.