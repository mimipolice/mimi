## Summary
Checks the bot's connection latency and replies with an interactive "Pong!" message.

## Syntax
```
/ping
```

## Parameters
This command does not take any parameters.

| Parameter | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| N/A | N/A | N/A | N/A |

## Return Value
On successful execution, the bot replies with a Discord Container message containing:
- **Title**: "🏓 **pong！**"
- **Content**: The current WebSocket Ping latency in milliseconds and a counter.
- **Thumbnail**: An animated GIF.
- **Button**: A button labeled "戳我" (Poke Me) that increments the counter in the message when clicked.

## Detailed Description
This command is primarily used to test the bot's responsiveness and its connection status to the Discord API. It returns the WebSocket `ping` value, which represents the time it takes for a heartbeat packet to be sent from the bot to Discord's servers and for an acknowledgment to be received.

The "戳我" (Poke Me) button in the message provides a simple form of interaction. Each click increments the counter, demonstrating the bot's ability to handle component interactions.

## Examples
In any channel where bot commands are permitted, type `/ping` and send it.
```
/ping
```
The bot will reply with an interactive message showing the latency.

## Error Handling/Exceptions
- This is a very basic command and is unlikely to produce errors.
- If the Discord API is experiencing issues or the bot is not properly connected, the command may fail to execute or not respond.

## See Also
- N/A