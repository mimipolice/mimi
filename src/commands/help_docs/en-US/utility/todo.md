## Summary
Manages your personal to-do list.

## Syntax
```
/todo <subcommand> [options]
```

## Parameters

### `add` Subcommand
Adds an item to your to-do list.

| Parameter | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `item` | String | The content of the to-do item. | Yes |

### `remove` Subcommand
Removes an item from your to-do list.

| Parameter | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `id` | Integer | The ID of the item to remove. Supports autocomplete. | Yes |

### `list` Subcommand
Lists all your current to-do items.

| Parameter | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| N/A | N/A | N/A | N/A |

### `clear` Subcommand
Clears your entire to-do list.

| Parameter | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| N/A | N/A | N/A | N/A |

## Return Value
- On successful execution, all subcommands return an ephemeral (visible only to you) confirmation or informational message.
- If an error occurs, it returns an ephemeral error message.

## Detailed Description
The `/todo` command provides a complete and private to-do list management suite. Your list is visible only to you and is entirely separate from other users' lists.

- **`add`**: Quickly add a new to-do item.
- **`remove`**: Remove completed or unnecessary items via their unique ID. The `id` parameter here supports autocomplete; as you type, it will show matching items from your list, making it easy to select and remove them.
- **`list`**: Check what tasks you still have pending at any time.
- **`clear`**: Wipes the entire list at once, suitable for use after completing a major phase of tasks.

All interactions are ephemeral, ensuring they do not clutter public channels.

## Examples
**To add a to-do item:**
```
/todo add item: Finish the project report
```

**To remove the to-do item with ID 3:**
```
/todo remove id: 3
```

**To view my to-do list:**
```
/todo list
```

**To clear my entire to-do list:**
```
/todo clear
```

## Error Handling/Exceptions
- **Item Not Found**: Providing an ID that does not exist in your list when using `/todo remove`.
- **Database Error**: A backend error occurs while accessing your to-do list.

## See Also
- N/A