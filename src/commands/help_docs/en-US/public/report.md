# Command: /report

## Overview
Generates a price report for assets, including a detailed analysis of a single asset and a list of all available assets.

## Syntax
```
/report <subcommand> [options]
```

## Parameters

### `list` Subcommand
Lists all queryable assets and their latest price update time.

| Parameter | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| N/A | N/A | N/A | N/A |

### `symbol` Subcommand
Retrieves a detailed price report for a single asset within a specified time range.

| Parameter | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `symbol` | String | The ticker symbol or name of the asset. Autocomplete is supported. | Yes |
| `range` | String | The time range, e.g., `7d` (7 days), `1m` (1 month), `all` (all time). Defaults to `7d`. | No |

## Return Value
- **`list`**: Returns a text message containing the symbols, names, and last update times of all assets.
- **`symbol`**: Returns a Discord embed message containing:
    - **Title**: The asset's name and symbol.
    - **Summary**: Includes the highest, lowest, and average price.
    - **Price Change**: Shows the current price, absolute price change, and percentage change.
    - **Price Chart**: A visual chart of the price history.

## Description
The `/report` command is a powerful tool for querying asset price information.

- **`list`**: Provides a quick way to view all available assets in the system, allowing users to see what they can query.
- **`symbol`**: This subcommand is the core feature. It fetches the price history for a specified asset from the database within a given time range and performs a statistical analysis. It calculates the highest, lowest, and average prices, as well as the price change relative to the starting point. Most importantly, it dynamically generates a price trend chart, allowing users to intuitively understand the price trend. The color of the left border of the returned message will change based on the price movement (green for an increase, red for a decrease).

## Examples
**List all available assets:**
```
/report list
```

**Get the price report for the asset "MIMI" for the last month:**
```
/report symbol symbol: MIMI range: 1m
```

## Error Handling / Edge Cases
- **Invalid Time Range**: The user provides an unparsable format for the `range` parameter.
- **No Data Found**: No price data for the asset can be found within the specified time range.
- **Chart Generation Failed**: An error occurred on the backend while generating the price chart.

## Related
- N/A