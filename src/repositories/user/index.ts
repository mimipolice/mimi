// User Repository - Modular exports
// This file re-exports all user-related repository functions for backward compatibility

// User Info
export { getUserInfoData } from "./user-info.repository";

// User Balance
export {
  updateUserBalance,
  updateUserBalancesForTrade,
} from "./user-balance.repository";

// User Transactions
export { getRecentTransactions } from "./user-transactions.repository";

// User Analytics
export {
  getCommandUsagePatterns,
  getCommandUsageFrequency,
  getServerActivityTrends,
  getCommandUsageByType,
} from "./user-analytics.repository";

// User Financials
export {
  getTimePeriodFinancials,
  getAnomalyData,
} from "./user-financials.repository";
