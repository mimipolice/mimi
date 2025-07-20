# Command: /config

## Summary
Configures or views the core parameters for the ticket bot on this server.

## Syntax
```
/config <subcommand> [options]
```

## Parameters
This command requires **Administrator** permissions.

### `set` Subcommand
Sets all the necessary channels and roles for the ticket system in one go.

| Parameter | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `staff_role` | Role | The role for staff who can manage and reply to tickets. | Yes |
| `ticket_category` | Category | The category where new ticket channels will be created. | Yes |
| `log_channel` | Channel | The channel where all ticket events (creation, closing, etc.) are logged. | Yes |
| `panel_channel` | Channel | The channel where the ticket creation panel will be sent. | Yes |
| `archive_category` | Category | The category where closed/archived tickets will be stored. | Yes |

### `view` Subcommand
Views the current configuration for the ticket bot on the server.

| Parameter | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| N/A | N/A | N/A | N/A |

## Return Value
- **Success**: On successful execution, the bot replies with an ephemeral confirmation or informational message.
- **Failure**: If an error occurs, the bot replies with an ephemeral error message.

## Detailed Description
The `/config` command is fundamental to the ticket system. Before the system can operate correctly, the `/config set` command must be used to complete the entire setup. This command ensures the bot knows where to create channels, log events, send the panel, and which roles have permission to manage tickets.

- **`set`**: This is the key command for initial setup. You must provide all five options at once to ensure the system's configuration is complete.
- **`view`**: Allows administrators to quickly check the current settings without needing to run the `set` command again, just to confirm that everything is configured correctly.

## Examples
**To set all required parameters:**
```
/config set staff_role: @SupportTeam ticket_category: #Tickets log_channel: #ticket-logs panel_channel: #get-help archive_category: #Archived Tickets
```

**To view the current configuration:**
```
/config view
```

## Error Handling/Exceptions
- **Insufficient Permissions**: A non-administrator attempts to execute this command.
- **Missing Parameters**: Not all five required options are provided when using `/config set`.
- **Configuration Not Found**: Using `/config view` when no settings have been configured for the server yet.

## See Also
- `/panel`