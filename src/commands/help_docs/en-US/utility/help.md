## Summary
Displays an interactive help center that allows you to browse all available command categories and their detailed descriptions.

## Syntax
```
/help
```

## Parameters
This command does not take any parameters.

## Return Value
On successful execution, the bot replies with an embed containing:
- **Category Menu**: A dropdown menu listing all command categories available to you (e.g., `public`, `admin`).
- **Command Menu**: After selecting a category, a second dropdown menu appears, listing all available commands in that category.
- **Detailed Description**: After selecting a command, its detailed help document is displayed.
- **Language Toggle Button**: You can switch the language of the help documents between "繁體中文" and "English".
- **Home Button**: Return to the initial page of the help center at any time.

## Detailed Description
The `/help` command dynamically displays commands and categories based on your permissions. For example, only administrators will see commands in the `admin` category.

This is an excellent way to explore all the features the bot has to offer.