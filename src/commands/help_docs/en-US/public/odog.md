# Command: /odog

## Summary
Displays the Odog gacha rankings for players, with options to filter by a specific gacha pool and time period.

## Syntax
```
/odog [gacha_id] [period]
```

## Parameters

| Parameter | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `gacha_id` | String | The ID of the gacha pool to rank. Supports autocomplete. If omitted, shows global rankings across all pools. | No |
| `period` | String | The time period for the rankings. Format is `[number]d` (e.g., `7d`) or `all`. Defaults to `7d`. | No |

## Return Value
On successful execution, the bot replies with a **spoiler-tagged** Discord Container message that includes:
- **Title**: Indicates the gacha pool and time period for the rankings.
- **Ranking List**:
    - Displays up to the top 15 players.
    - For each player, it shows their nickname, a statistical breakdown of draws by rarity, and the total number of draws.

## Detailed Description
The `/odog` command provides a leaderboard to check player luck and investment in gacha events. Users can view rankings for a specific gacha pool or see the global rankings across all pools by leaving `gacha_id` empty.

- **Time Period (`period`)**: This parameter allows users to view rankings within a specific timeframe, such as `7d` for the last seven days, `30d` for the last thirty days, or `all` for the all-time rankings.
- **Autocomplete**: The `gacha_id` parameter supports autocomplete. As the user types, it will dynamically suggest matching gacha pools, making it easy to select the correct one.
- **Spoiler Tag**: To prevent spamming the channel or causing disputes, the reply is spoiler-tagged by default. Users must click to reveal the content.

## Examples
**To view the global rankings for the last 7 days:**
```
/odog
```

**To view the all-time rankings for a specific gacha pool "fes_gacha":**
```
/odog gacha_id: fes_gacha period: all
```

## Error Handling/Exceptions
- **Invalid `period` Format**: The user provides a time format that cannot be parsed (e.g., `7days` instead of `7d`).
- **No Data Found**: No ranking data is available for the specified gacha pool and time period.
- **Database Error**: A backend error occurs while fetching the ranking data.

## See Also
- N/A