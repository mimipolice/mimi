## Summary
Set, view, or remove price alerts for specific assets. The system will notify you via DM when the market price meets the conditions you've set.

## Syntax
```
/pricealert <subcommand> [options]
```

## Subcommands

### Set Alert
Sets a new price alert.

| Parameter | Type | Description | Required |
| --- | --- | --- | :---: |
| `Symbol` | String | The asset you want to track. | Yes |
| `Condition` | String | `Above`: Triggers when the price **rises above** the target price.<br>`Below`: Triggers when the price **falls below** the target price. | Yes |
| `Price` | Number | The target price you set. | Yes |
| `Repeatable` | Boolean | Sets whether the alert should be repeatable. Defaults to `False`. | No |

### List Alerts
Lists all of your currently active price alerts.

### Remove Alert
Removes a previously set price alert.

| Parameter | Type | Description | Required |
| --- | --- | --- | :---: |
| `Alert ID` | String | The unique ID found in your alert list. | Yes |

## Notes
- Unless set to repeatable, alerts are one-time triggers. Once an alert is triggered, it is automatically removed.
- Price data is based on the in-system simulated market and may differ from real-world market prices.