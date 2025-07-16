# Mimi - A Multi-functional Discord Bot

Mimi is a powerful and versatile Discord bot built with TypeScript, discord.js v14, and PostgreSQL. Originally a JavaScript project, it has been completely refactored to enhance performance, scalability, and maintainability.

[繁體中文](./README.zh-TW.md)

## 🌟 Features

*   **📈 Asset Reporting**: Fetches and displays historical price data for various assets, complete with detailed charts showing price and volume.
*   **🏆 Gacha Luck Ranking**: Tracks and ranks users' luck in gacha-style games with the `/odog` command, providing detailed statistics.
*   **✍️ Keyword Auto-Reply**: Automatically replies to pre-configured keywords with either exact or partial matching.
*   **👍 Channel Auto-Reaction**: Automatically adds a specific emoji reaction to every new message in designated channels.
*   **✅ Personal Todo List**: A simple yet effective to-do list management system for every user.
*   **📊 User-Specific Reports**: Generates detailed reports on user activity, including command usage, game statistics, and gacha behavior.
*   **❓ Dynamic Help Command**: Provides a comprehensive list of all available commands or detailed information about a specific command.

## 🛠️ Tech Stack

*   **Language**: TypeScript
*   **Framework**: Node.js
*   **Core Library**: `discord.js` v14
*   **Database**: PostgreSQL
*   **Chart Generation**: `chart.js` with `node-canvas`

## 🏗️ Architecture Overview

Mimi's architecture is designed to be modular and scalable. Here's a high-level overview:

*   **Command Handling**: Slash commands are dynamically loaded from the `src/commands` directory. The main client in `src/index.ts` listens for `InteractionCreate` events and executes the corresponding command logic.
*   **Database Interaction**: All database queries are centralized in `src/shared/database/queries.ts`, providing a clean and maintainable data access layer. It uses the `pg` library to connect to a PostgreSQL database.
*   **Caching**: To optimize performance and reduce database load, frequently accessed data like keyword and auto-reaction settings are stored in an in-memory cache, managed by `src/shared/cache.ts`.
*   **Modular Utilities**: Specialized functionalities like chart generation (`src/utils/chart-generator.ts`) and error handling (`src/utils/errorHandler.ts`) are encapsulated in their own modules.

## 🚀 Setup and Installation

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

*   `DISCORD_TOKEN`: Your Discord bot's token.
*   `CLIENT_ID`: Your bot's client ID.
*   `DB_HOST`: Database host.
*   `DB_PORT`: Database port.
*   `DB_USER`: Database username.
*   `DB_PASSWORD`: Database password.
*   `DB_NAME`: Database name.

### Step 4: Set Up the Database

The application is designed to work with a PostgreSQL database. The required table schemas are defined in `src/shared/database/schema.sql`. You will need to manually create the tables in your database.

## 🏃 Running the Bot

### Step 1: Build the Code

```bash
npm run build
```

### Step 2: Deploy Slash Commands

Before starting the bot, you need to register its slash commands with Discord.

```bash
npm run deploy
```
This command reads all command files from `dist/commands` and registers them globally.

### Step 3: Start the Bot

You can run the bot in two modes:

*   **Development Mode**: Uses `nodemon` for hot-reloading.
    ```bash
    npm run dev
    ```
*   **Production Mode**: Runs the compiled JavaScript code.
    ```bash
    npm run start
    ```

## 🤖 Command Documentation

Here is a detailed list of all available slash commands.


### `/help`
Displays a list of all available commands or provides detailed information about a specific command.

*   **Usage**:
    *   To see all commands: `/help`
    *   To get help for a specific command: `/help command:<command_name>`
*   **Example**:
    ```
    /help command:report
    ```

### `/report`
Generates price reports for assets.

*   **Subcommands**:
    *   `symbol`: Get a detailed report for a single asset, including a price/volume chart.
        *   **Options**:
            *   `symbol` (Required): The symbol or name of the asset. (Autocomplete enabled)
            *   `range` (Optional): The time range for the report (e.g., `7d`, `1m`, `all`). Defaults to `7d`.
        *   **Example**: `/report symbol symbol:TSLA range:1m`
    *   `list`: List all available assets and their latest recorded price.
        *   **Example**: `/report list`

### `/odog`
Shows the Odog gacha rankings, tracking user luck based on top-tier draws.

*   **Options**:
    *   `gacha_id` (Optional): The specific gacha pool to rank. (Autocomplete enabled)
    *   `period` (Optional): The time period for the rankings (e.g., `7d`, `30d`, `all`). Defaults to `7d`.
*   **Example**:
    ```
    /odog gacha_id:special_event period:30d
    ```

### `/autoreact`
Manages automatic emoji reactions for specific channels.

*   **Subcommands**:
    *   `set`: Sets or updates an auto-reaction for a channel.
        *   **Options**: `emoji` (Required), `channel` (Required)
        *   **Example**: `/autoreact set emoji:🎉 channel:#announcements`
    *   `remove`: Removes the auto-reaction from a channel.
        *   **Options**: `channel` (Required)
        *   **Example**: `/autoreact remove channel:#announcements`
    *   `list`: Lists all currently configured auto-reactions.
        *   **Example**: `/autoreact list`

### `/keyword`
Manages keyword-based auto-replies.

*   **Subcommands**:
    *   `add`: Adds or updates a keyword and its reply.
        *   **Options**: `type` (Required: "Exact Match" or "Contains Match"), `keyword` (Required), `reply` (Required)
        *   **Example**: `/keyword add type:"Exact Match" keyword:hello reply:"Hello there!"`
    *   `remove`: Removes a keyword.
        *   **Options**: `keyword` (Required, Autocomplete enabled)
        *   **Example**: `/keyword remove keyword:hello`
    *   `list`: Lists all configured keywords and their replies.
        *   **Example**: `/keyword list`

### `/todo`
A personal to-do list manager.

*   **Subcommands**:
    *   `add`: Adds a new item to your to-do list.
        *   **Options**: `item` (Required)
        *   **Example**: `/todo add item:Finish the documentation`
    *   `remove`: Removes a task by its ID.
        *   **Options**: `id` (Required, Autocomplete enabled)
        *   **Example**: `/todo remove id:1`
    *   `list`: Displays your current to-do list.
        *   **Example**: `/todo list`
    *   `clear`: Clears your entire to-do list.
        *   **Example**: `/todo clear`

### `/user-report`
Generates a detailed, private report of your activity on the server.

*   **Report Includes**:
    *   Most used commands.
    *   Spending vs. income statistics.
    *   Detailed game statistics.
    *   In-depth gacha behavior analysis (total draws, wish hit rate, favorite pools, rarity stats).
*   **Usage**:
    ```
    /user-report
    ```

## 🤝 Contributing

Contributions are welcome! If you want to add a new command, follow these steps:

1.  Create a new file in the `src/commands/` directory (e.g., `src/commands/new-command.ts`).
2.  Use the existing commands as a template. You'll need to export a `data` object using `SlashCommandBuilder` and an `execute` function to handle the command's logic.
3.  If your command requires database interaction, add the necessary query functions to `src/shared/database/queries.ts`.
4.  Once your command is ready, run `npm run deploy` to register it with Discord.
