# Anti-Spam System Documentation

## Overview

The Anti-Spam system is an automated security feature that protects Discord servers from spam and malicious behavior. It monitors message patterns in real-time and automatically takes action against users who exceed spam thresholds.

## Key Features

- **Automatic Detection**: Real-time monitoring of message patterns
- **Dual Detection Methods**: Single-channel and multi-channel spam detection
- **Automatic Moderation**: Automatic timeout for violators
- **Appeal System**: Users can appeal false positives
- **Admin Notifications**: Detailed logs sent to administrators
- **Privacy-Focused**: Only stores metadata (timestamps, channel IDs), never message content

## How It Works

### Detection Methods

#### 1. Single-Channel Spam Detection
Triggers when a user sends too many messages in a single channel within a short time period.

**Default Settings:**
- **Threshold**: 7 messages
- **Time Window**: 8 seconds
- **Action**: User is timed out for 24 hours

**Example Scenario:**
```
User sends 7 messages in #general within 8 seconds
→ System detects spam
→ User is automatically timed out
```

#### 2. Multi-Channel Spam Detection
Triggers when a user rapidly posts across multiple different channels.

**Default Settings:**
- **Threshold**: 6 different channels
- **Time Window**: 12 seconds
- **Action**: User is timed out for 24 hours

**Example Scenario:**
```
User posts in #general, #chat, #discussion, #random, #help, #support within 12 seconds
→ System detects multi-channel spam
→ User is automatically timed out
```

## What Happens When Spam is Detected

### 1. User is Timed Out
- The violating user is automatically given a timeout (default: 24 hours)
- A notification is posted in the channel where the violation occurred

### 2. User Receives DM
The user receives a direct message containing:
- Notification of the timeout
- Reason for the timeout
- Duration of the timeout
- An **Appeal Button** to contest the decision if they believe it was a mistake

### 3. Admin Notification
Administrators receive a detailed embed in the configured log channel with:
- User information (ID, mention)
- Link to the triggering message
- Reason for timeout
- Timestamp
- Timeout duration

## Configuration

### Setting Up the Log Channel

Administrators must configure a log channel to receive spam notifications:

```
/config set anti_spam_log_channel #your-log-channel
```

If no log channel is configured, the system will still function but will post a notification in the channel where the violation occurred.

### Customizing Settings

Server administrators can customize the following settings:

| Setting | Default | Description |
|---------|---------|-------------|
| Single-channel threshold | 7 messages | Number of messages in one channel to trigger detection |
| Single-channel window | 8 seconds | Time window for single-channel detection |
| Multi-channel threshold | 6 channels | Number of different channels to trigger detection |
| Multi-channel window | 12 seconds | Time window for multi-channel detection |
| Timeout duration | 24 hours | How long users are timed out |

### Ignored Users and Roles

The system can be configured to ignore certain users or roles (e.g., moderators, bots):

**Environment Variables:**
```
ANTISPAM_IGNORED_USERS=userid1,userid2,userid3
ANTISPAM_IGNORED_ROLES=roleid1,roleid2,roleid3
```

## Appeal System

### For Users

If you believe you were timed out by mistake:

1. Check your DM from the bot
2. Click the **"I believe this is a mistake (Appeal)"** button
3. Your appeal will be sent to the server administrators
4. Wait for a moderator to review your case

### For Administrators

When a user appeals:
1. You'll receive a notification with the appeal details
2. Review the user's message history and the violation
3. Decide whether to remove the timeout or keep it
4. Communicate with the user as needed

## Data Privacy

### What We Store
- **Message Timestamps**: When messages were sent
- **Channel IDs**: Which channels messages were sent in
- **User IDs**: Who sent the messages

### What We DON'T Store
- ❌ Message content
- ❌ Message text
- ❌ Attachments
- ❌ Any personally identifiable information beyond Discord IDs

### Data Retention
- All spam detection data is stored in **Redis cache**
- Data automatically expires after **2 hours** of inactivity
- Once a user is timed out, their message history is cleared
- No long-term storage of message data

## Technical Details

### Architecture

```
Message Event
    ↓
Filter bots & check guild membership
    ↓
Load guild-specific settings
    ↓
Check if user/role is ignored
    ↓
Retrieve user's message history from cache
    ↓
Add current message to history
    ↓
Check spam detection rules
    ↓
If spam detected:
  - Mark user as punished in cache
  - Apply Discord timeout
  - Send DM with appeal button
  - Notify administrators
  - Clear user's message history
Else:
  - Update cache with new timestamp
```

### Cache Key Format
```
antispam:{userId}
```

### Cached Data Structure
```typescript
{
  timestamps: [
    { ts: 1234567890, channelId: "123456789" },
    { ts: 1234567891, channelId: "987654321" },
    ...
  ],
  punishedUntil: 1234567890 | null
}
```

## Best Practices

### For Server Administrators

1. **Configure a dedicated log channel** for spam notifications
2. **Review the default settings** and adjust if needed for your community
3. **Add trusted roles to the ignore list** (moderators, verified members)
4. **Respond to appeals promptly** to maintain user trust
5. **Monitor the system** for false positives and adjust settings accordingly

### For Users

1. **Avoid rapid-fire messaging** - take a moment between messages
2. **Don't cross-post** the same message across multiple channels
3. **If timed out by mistake**, use the appeal system
4. **Wait for moderator response** after appealing

## Troubleshooting

### System Not Working

**Check:**
1. Bot has `Moderate Members` permission
2. Bot's role is above the roles of users it should moderate
3. Log channel is configured (optional but recommended)

### False Positives

**If the system is triggering too often:**
1. Increase the thresholds (more messages required)
2. Extend the time windows (longer period)
3. Add specific users/roles to ignore list

### False Negatives

**If spammers are getting through:**
1. Decrease the thresholds (fewer messages required)
2. Shorten the time windows (shorter period)
3. Ensure bot permissions are correct

## FAQ

**Q: Will this affect normal conversation?**
A: No. The default settings are designed to allow normal rapid conversation while catching obvious spam patterns.

**Q: Can users bypass this by waiting between messages?**
A: The system is designed to catch rapid spam. Users who wait a few seconds between messages won't trigger it.

**Q: What happens if a moderator is spamming?**
A: If moderators are added to the ignored roles list, they won't be affected. Otherwise, the system treats everyone equally.

**Q: Can I see who has been timed out?**
A: Yes, all timeouts are logged in your configured log channel with full details.

**Q: How do I disable the anti-spam system?**
A: Currently, the system is always active. You can effectively disable it by setting very high thresholds or adding all roles to the ignore list.

**Q: Does this use message content for detection?**
A: No. The system only tracks when and where messages are sent, not what they contain.

## Support

If you need help with the Anti-Spam system:
1. Check this documentation
2. Review the configuration settings
3. Contact server administrators
4. Join our support server: https://discord.gg/kDua5dDt4v

## Version History

- **v1.0**: Initial release with single-channel and multi-channel detection
- **v1.1**: Added appeal system
- **v1.2**: Improved cache synchronization with Discord timeout state
- **v1.3**: Fixed multi-channel detection logic
