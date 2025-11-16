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

The Anti-Spam system automatically detects and handles spam behavior to protect your server.

### How It Works
- **Single-Channel Detection**: Triggers when a user sends too many messages in one channel
- **Multi-Channel Detection**: Triggers when a user rapidly posts across multiple channels
- **Automatic Timeout**: Violators are automatically timed out
- **Appeal System**: Users can appeal false positives via DM
- **Admin Notifications**: Detailed logs sent to configured channel

### `set` Subcommand
Configure anti-spam detection parameters.

| Parameter | Type | Description | Required | Default |
| :--- | :--- | :--- | :--- | :--- |
| `threshold` | Integer | Messages in one channel to trigger detection | Yes | 7 |
| `timeout` | Integer | Timeout duration in seconds (e.g., 86400 = 24 hours) | Yes | 86400 |
| `time_window` | Integer | Time window in seconds for single-channel detection | Yes | 8 |
| `multi_channel_threshold` | Integer | Number of different channels to trigger detection | No | 6 |
| `multi_channel_window` | Integer | Time window in seconds for multi-channel detection | No | 12 |

**Note**: The system only stores message metadata (timestamps, channel IDs), never message content.

### `show` Subcommand
Shows the current anti-spam settings and detection rules.

### `reset` Subcommand
Resets the anti-spam settings to their default values.

### Setting Log Channel
Configure where anti-spam notifications are sent:
```
/config set anti_spam_log_channel: #spam-logs
```

For detailed documentation, see: [Anti-Spam System Guide](https://github.com/956zs/mimi/blob/main/docs/features/anti-spam.md)

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
