 Command: /autoreact

## Summary
Manages automatic message reactions in specific channels, allowing the bot to automatically add a specified emoji to new messages.

## Syntax
```
/autoreact <subcommand> [options]
```

## Parameters
This command requires the **Manage Channels** permission.

### `set` Subcommand
Sets an auto-reaction for a specified channel.

| Parameter | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `emoji` | String | The emoji to automatically react with (can be standard or custom). | Yes |
| `channel` | Channel | The text channel to set the auto-reaction for. | Yes |

### `remove` Subcommand
Removes the auto-reaction setting from a channel.

| Parameter | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `channel` | Channel | The text channel to remove the auto-reaction from. | Yes |

### `list` Subcommand
Lists all configured auto-reactions for this server.

| Parameter | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| N/A | N/A | N/A | N/A |

## Return Value
- **Success**: On successful execution, the bot replies with an ephemeral confirmation or informational message.
- **Failure**: If an error occurs, the bot replies with an ephemeral error message.

## Detailed Description
`/autoreact` is a useful administrative tool, often used in announcement or polling channels to ensure every message receives a consistent initial reaction.

- **`set`**: Once configured, any new message posted in the specified channel will be immediately reacted to by the bot with the designated `emoji`.
- **`remove`**: Cancels the auto-reaction setting for a channel.
- **`list`**: Allows administrators to quickly view all currently active auto-reaction configurations for easy management.

After every successful `set` or `remove` execution, the system's cache is reloaded to ensure the changes take effect immediately.

## Examples
**Set a 📣 reaction for the #announcements channel:**
```
/autoreact set emoji: 📣 channel: #announcements
```

**Remove the auto-reaction from the #announcements channel:**
```
/autoreact remove channel: #announcements
```

**View all configurations:**
```
/autoreact list
```

## Error Handling/Exceptions
- **Insufficient Permissions**: The user lacks the `Manage Channels` permission.
- **Database Error**: An issue occurs while reading from or writing to the database.

## See Also
- N/A