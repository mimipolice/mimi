# Command: /ticket

## Summary
Manages ticket-related operations, including adding/removing members and purging all tickets.

## Syntax
```
/ticket <subcommand> [options]
```

## Parameters

### `add` Subcommand
Adds a user to the current ticket channel.

| Parameter | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `user` | User | The user to add to this ticket. | Yes |

### `remove` Subcommand
Removes a user from the current ticket channel.

| Parameter | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `user` | User | The user to remove from this ticket. | Yes |

### `purge` Subcommand
**[Administrator-only]** Permanently deletes all ticket data on the server and resets the ID counter.

| Parameter | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| N/A | N/A | N/A | N/A |

## Return Value
- **Success**: On successful execution, the bot replies with an ephemeral confirmation message.
- **Failure**: If an error occurs (e.g., not in a ticket channel, insufficient permissions), the bot replies with an ephemeral error message.

## Detailed Description
The `/ticket` command is a multi-functional management tool for handling member access to ticket channels and for system-wide maintenance.

- The `add` and `remove` subcommands can only be used within a ticket channel. They function by modifying the channel's permission overwrites to grant or deny a specific user the ability to view the channel.
- The `purge` subcommand is a high-risk, administrator-only operation. Executing it will prompt for confirmation with a button to prevent accidental use. Once confirmed, it will wipe all ticket-related records from the database. This action is irreversible.

## Examples
**To add a user to a ticket:**
In a ticket channel, use the following command:
```
/ticket add user: @Username
```

**To remove a user from a ticket:**
In a ticket channel, use the following command:
```
/ticket remove user: @Username
```

**To purge all tickets (Admin only):**
```
/ticket purge
```

## Error Handling/Exceptions
- **Insufficient Permissions**: A non-administrator attempts to execute `/ticket purge`.
- **Not a Ticket Channel**: Attempting to use the `add` or `remove` subcommands in a non-ticket channel.
- **User Not Found**: An invalid user is provided for `add` or `remove`.

## See Also
- `/panel` (For configuring the ticket creation panel)