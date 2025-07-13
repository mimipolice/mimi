# Mimi a Discord Bot

A multi-functional Discord bot built with TypeScript, discord.js v14, and PostgreSQL. Originally a JavaScript project, it has been fully refactored for better performance, scalability, and maintainability.

## Features

*   📈 **Stock History**: Fetches and displays historical stock data with charts.
*   🏆 **Gacha Luck Ranking**: Tracks and ranks users' luck in gacha-style games with the `/odog` command.
*   ✍️ **Auto-Reply**: Automatically replies to specific keywords.
*   👍 **Auto-Reaction**: Automatically adds emoji reactions to messages in configured channels.
*   ✅ **Todo List**: A simple to-do list management system.
*   ❓ **Help Command**: Provides detailed information about all available commands.

## Tech Stack

*   **Language**: TypeScript
*   **Framework**: Node.js
*   **Database**: PostgreSQL
*   **Core Libraries**: `discord.js` v14, `pg`

## Setup and Installation

Follow these steps to set up and run the bot locally.

### Step 1: Clone the Project

```bash
git clone https://github.com/your-username/mimi.git
cd mimi
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Set Up Environment Variables

Copy the example environment file and fill in your credentials.

```bash
cp .env.example .env
```

You will need to edit the `.env` file with the following values:

*   `BOT_TOKEN`: Your Discord bot's token from the Discord Developer Portal.
*   `CLIENT_ID`: Your bot's client ID from the Discord Developer Portal.
*   `GUILD_ID`: The ID of the Discord server where you want to register the commands initially.
*   `DATABASE_URL`: The connection string for your PostgreSQL database. (e.g., `postgresql://user:password@host:port/database`)

### Step 4: Set Up the Database

The application is designed to work with a PostgreSQL database. On its first launch, it will automatically create the necessary tables based on the schema defined in `src/shared/database/schema.sql`. Ensure your PostgreSQL instance is running and the `DATABASE_URL` is correctly configured.

## Running the Bot

### Step 1: Deploy Slash Commands

Before starting the bot, you need to register its slash commands with Discord.

```bash
npm run deploy
```
This command reads all command files from `src/commands` and registers them for your server.

### Step 2: Start the Bot

You can run the bot in two modes:

*   **Development Mode**: Uses `nodemon` for hot-reloading when you make changes to the code.
    ```bash
    npm run dev
    ```
*   **Production Mode**: Runs the compiled JavaScript code.
    ```bash
    npm run start
    ```

## Commands

Here is a detailed list of all available slash commands.

### `/help`
Displays a list of all available commands and their descriptions.

```
/help
```

### `/report`
Generates a historical price report and chart for a given stock symbol.

*   **Usage**:
    ```
    /report symbol:<stock_symbol>
    ```
*   **Example**:
    ```
    /report symbol:TSLA
    ```

### `/odog`
A command for tracking and ranking gacha luck.

*   **Usage**:
    ```
    /odog
    ```
    This command shows the current luck ranking.

### `/autoreact`
Manages automatic emoji reactions for specific channels.

*   `set`: Sets up an auto-reaction for a channel. The bot will react with the specified emoji to every new message.
    ```
    /autoreact set emoji:👍 channel:#general
    ```
*   `remove`: Removes the auto-reaction setting from a channel.
    ```
    /autoreact remove channel:#general
    ```
*   `list`: Lists all currently configured auto-reactions.
    ```
    /autoreact list
    ```

### `/keyword`
Manages keyword-based auto-replies.

*   `set`: Adds a new keyword and its corresponding reply.
    ```
    /keyword set keyword:hello reply:Hello there!
    ```
*   `remove`: Removes a keyword.
    ```
    /keyword remove keyword:hello
    ```
*   `list`: Lists all configured keywords and their replies.
    ```
    /keyword list
    ```

### `/todo`
A personal to-do list manager.

*   `add`: Adds a new item to your to-do list.
    ```
    /todo add task:Finish the README
    ```
*   `list`: Displays your current to-do list.
    ```
    /todo list
    ```
*   `done`: Marks a task as completed by its ID.
    ```
    /todo done id:1
    ```

## Contributing

Contributions are welcome! If you want to add a new command, follow these steps:

1.  Create a new file in the `src/commands/` directory (e.g., `src/commands/new-command.ts`).
2.  Use the existing commands as a template. You'll need to export a `data` object using `SlashCommandBuilder` and an `execute` function to handle the command's logic.
3.  If your command requires database interaction, add the necessary query functions to `src/shared/database/queries.ts`.
4.  Once your command is ready, run `npm run deploy` to register it with Discord.
