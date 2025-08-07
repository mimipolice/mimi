## Summary
Configures or views various features for this server, including the ticket system and anti-spam functionality.

## Syntax
```
/config <subcommand_group> <subcommand> [options]
```

## Permissions
This command requires **Administrator** permissions.

---

## Ticket System Settings

### `set` Subcommand
Sets all the necessary channels and roles for the ticket system in one go.

| Parameter | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `staff_role` | Role | The role for staff who can manage and reply to tickets. | Yes |
| `ticket_category` | Category | The category where new ticket channels will be created. | Yes |
| `log_channel` | Channel | The channel where all ticket events (creation, closing, etc.) are logged. | Yes |
| `panel_channel` | Channel | The channel where the ticket creation panel will be sent. | Yes |
| `archive_category` | Category | The category where closed/archived tickets will be stored. | Yes |
| `anti_spam_log_channel` | Channel | The channel for logging anti-spam events. | No |

### `view` Subcommand
Views the current configuration for the ticket bot on the server.

---

## Anti-Spam Settings (`/config anti-spam`)

### `set` Subcommand
Sets the anti-spam parameters.

| Parameter | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `threshold` | Integer | The number of messages a user can send within the time window to trigger detection. | Yes |
| `timeout` | Integer | How long to time out the user for (in seconds) after spam is detected. | Yes |
| `time_window` | Integer | The time window in seconds for spam detection. | Yes |

### `show` Subcommand
Shows the current anti-spam settings.

### `reset` Subcommand
Resets the anti-spam settings to their default values.

## Examples
**To set up the ticket system:**
```
/config set staff_role: @SupportTeam ticket_category: #Tickets log_channel: #ticket-logs panel_channel: #get-help archive_category: #Archived Tickets
```

**To configure the anti-spam feature:**
```
/config anti-spam set threshold: 5 timeout: 60 time_window: 10
```

**To view all settings:**
```
/config view
/config anti-spam show
```