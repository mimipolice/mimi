# Price Alert (`/pricealert`)

Set, view, or remove price alerts for specific assets. The system will notify you via DM when the market price meets the conditions you've set.

## Subcommands

### Set Alert (`/pricealert set`)
Sets a new price alert.

- **Symbol**: The asset you want to track.
- **Condition**:
  - `Above`: Triggers when the price **rises above** the target price.
  - `Below`: Triggers when the price **falls below** the target price.
- **Price**: The target price you set.

### List Alerts (`/pricealert list`)
Lists all of your currently active price alerts.

### Remove Alert (`/pricealert remove`)
Removes a previously set price alert.
- **Alert ID**: The unique ID found in your alert list.

## Notes
- Alerts are one-time triggers. Once an alert is triggered, it is automatically removed.
- Price data is based on the in-system simulated market and may differ from real-world market prices.