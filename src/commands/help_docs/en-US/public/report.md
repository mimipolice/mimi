## Summary
Generates a detailed market report for a specific asset, including a candlestick chart and key statistics, or lists all available assets for trading.

## Syntax
```
/report <subcommand> [options]
```

## Subcommands

### `symbol`
Generates a price report for a specific asset.

| Parameter | Type   | Description                                                                                             | Required |
| :-------- | :----- | :------------------------------------------------------------------------------------------------------ | :--- |
| `symbol`  | String | The asset symbol to query. Supports autocomplete to help you find the asset.                            | Yes      |
| `range`   | String | The time range for the report (e.g., `24h`, `7d`, `1m`). Defaults to `7d` (7 days). | No       |

### `list`
Lists all available asset symbols and their names.

| Parameter | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| N/A | N/A | N/A | N/A |

## Return Value
- **`/report symbol`**: A Discord Container message with a detailed market report, including:
    - A candlestick chart image showing the price trend.
    - Key statistics: highest price, lowest price, average price, and current price for the selected range.
- **`/report list`**: A simple text message listing all available assets.

## Detailed Description
The `/report` command is a powerful tool for market analysis.

- **Smart Interval Selection**: When you specify a `range`, the bot intelligently determines the most appropriate candlestick interval (e.g., 1h, 4h, 1d) to display a clear and readable chart with an optimal number of data points. You don't need to worry about picking the interval yourself.
- **Autocomplete**: The `symbol` parameter features autocomplete, suggesting assets as you type to make searching quick and easy.
- **Supported Ranges**: The `range` parameter is flexible, accepting units like `h` (hours), `d` (days), `w` (weeks), `m` (months), and `y` (years). For example, `30d` for 30 days or `1y` for one year.

## Examples
**To get a 7-day report for Bitcoin (BTC):**
```
/report symbol symbol: BTC
```

**To get a 24-hour report for Ethereum (ETH):**
```
/report symbol symbol: ETH range: 24h
```

**To get a 3-month report for Dogecoin (DOGE):**
```
/report symbol symbol: DOGE range: 3m
```

**To list all available assets:**
```
/report list
```

## Error Handling/Exceptions
- **No Data**: If there is insufficient historical data for the requested asset and time range, the bot will return an error message.
- **Invalid Symbol**: If the specified symbol does not exist.

## See Also
- N/A