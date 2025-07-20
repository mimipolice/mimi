# Command: /keyword

## Summary
Manages keyword-based auto-replies, allowing the bot to automatically send a preset message when a specific keyword is detected.

## Syntax
```
/keyword <subcommand> [options]
```

## Parameters
This command requires **Administrator** permissions.

### `add` Subcommand
Adds or updates a keyword and its reply.

| Parameter | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `type` | String | The matching type for the keyword. | Yes |
| `keyword` | String | The keyword to listen for. Supports autocomplete. | Yes |
| `reply` | String | The message content to reply with when the keyword is detected. | Yes |

### `remove` Subcommand
Removes a configured keyword.

| Parameter | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `keyword` | String | The keyword to remove. Supports autocomplete. | Yes |

### `list` Subcommand
Lists all configured keywords, their match types, and their replies.

| Parameter | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| N/A | N/A | N/A | N/A |

## Return Value
- On successful execution, all subcommands return an ephemeral (visible only to you) confirmation or informational message.
- If an error occurs, it returns an ephemeral error message.

## Detailed Description
The `/keyword` command is an automation tool used to set up automatic replies for frequently asked questions or to create fun interactions.

- **Match Type (`type`)**:
    - **`Exact Match`**: The bot will only reply if the user's message is **exactly equal to** the specified `keyword`.
    - **`Contains Match`**: The bot will reply if the user's message **contains** the specified `keyword`.
- **Autocomplete**: In the `add` and `remove` subcommands, the `keyword` parameter supports autocomplete. As you start typing, the system will suggest existing keywords, making it easy to update or remove them.
- **Cache Reload**: After every successful addition or removal of a keyword, the system's cache is automatically reloaded to ensure the changes take effect immediately.

## Examples
**To set an exact match keyword:**
```
/keyword add type: Exact Match keyword: !faq reply: Please check the #faq channel for frequently asked questions.
```

**To set a contains match keyword:**
```
/keyword add type: Contains Match keyword: good night reply: It's late, get some rest!
```

**To remove a keyword:**
```
/keyword remove keyword: !faq
```

**To view all keyword configurations:**
```
/keyword list
```

## Error Handling/Exceptions
- **Insufficient Permissions**: A non-administrator attempts to execute this command.
- **Database Error**: A backend error occurs while accessing the keyword list.

## See Also
- N/A