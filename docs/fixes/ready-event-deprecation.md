# Ready Event Deprecation Fix

## Issue
Discord.js 14.25.1 deprecated the `ready` event in favor of `clientReady` to distinguish it from the Gateway READY event.

**Warning:**
```
DeprecationWarning: The ready event has been renamed to clientReady 
to distinguish it from the gateway READY event and will only emit 
under that name in v15. Please use clientReady instead.
```

## Solution
Changed from string literal to `Events.ClientReady` enum.

### Before
```typescript
client.once("ready", async () => {
  // ...
});
```

### After
```typescript
import { Events } from "discord.js";

client.once(Events.ClientReady, async () => {
  // ...
});
```

## Files Modified
- `src/index.ts` - Updated client ready event listener

## Benefits
- Removes deprecation warning
- Future-proof for discord.js v15
- Type-safe event handling
- Clearer distinction between client ready and gateway READY events
