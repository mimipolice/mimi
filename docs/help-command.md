# `/help` Command Documentation

This document provides a comprehensive guide to the `/help` command, detailing its usage for end-users and providing instructions for developers on how to integrate new commands.

## User Guide

The `/help` command provides you with a personalized and interactive way to discover the commands you have permission to use.

### How to Use the `/help` Command

1.  **Execute the command:** Type `/help` in any channel. The bot will respond with an ephemeral message (visible only to you) containing a dropdown menu.
2.  **Select a category:** Click on the dropdown menu to see a list of command categories available to you. The categories are determined by your server permissions.
3.  **View commands:** Once you select a category, the message will update to display a list of all the commands you can use within that category. Each entry includes a clickable command mention and a brief description of what it does.

### Key Features

-   **Permission-Based:** The command automatically filters both categories and commands based on your roles and permissions. You will only see what you are allowed to use.
-   **Interactive and Ephemeral:** The menu is designed for easy navigation, and because the interaction is ephemeral, it keeps the channel clean for other members.
-   **Always Up-to-Date:** The help menu is generated dynamically, so it always reflects the most current list of available commands.

## Developer Guide

The `/help` command is designed to be fully dynamic, automatically discovering and displaying commands based on the project's file structure. To ensure your new commands are correctly indexed, follow the guidelines below.

### Command Structure

The bot's command structure is organized by category within the `src/commands/` directory. Each category has its own subdirectory.

```
src/commands/
├── <category_name>/
│   ├── <command_one>.ts
│   └── <command_two>.ts
└── <another_category>/
    └── <another_command>.ts
```

For the `/help` command to discover a new command, it must be placed in the appropriate category folder (e.g., `src/commands/utility/my-command.ts`).

### Adding a New Command

To add a new command and ensure it appears in the `/help` menu, you must correctly define its properties.

1.  **Create the command file:** Place your new command in the relevant category directory (e.g., `src/commands/public/new-command.ts`).
2.  **Define `data.description`:** The `description` property of the command's `data` object is crucial. This text is displayed next to the command in the help menu.

    ```typescript
    // src/commands/public/new-command.ts
    import { SlashCommandBuilder } from "discord.js";
    import { Command } from "../../interfaces/Command";

    export const command: Command = {
      data: new SlashCommandBuilder()
        .setName("new-command")
        .setDescription("This is a clear and concise description of the command."),
      // ... rest of the command logic
    };
    ```

3.  **Set `data.setDefaultMemberPermissions()`:** To manage access, use `setDefaultMemberPermissions()`. This ensures that the `/help` command only shows the command to users with the required permissions. If a command is public, you can omit this or set it to `null`.

    ```typescript
    import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
    // ...

    export const command: Command = {
      data: new SlashCommandBuilder()
        .setName("admin-command")
        .setDescription("An admin-only command.")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
      // ...
    };
    ```

By following these steps, your new command will be automatically and correctly displayed in the `/help` command's interactive menu.