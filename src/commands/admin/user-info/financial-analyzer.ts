/**
 * Financial Analysis Module
 * 
 * Provides financial analysis capabilities including:
 * - Time period financial calculations
 * - Anomaly detection and risk scoring
 * - Financial data type definitions
 */

// ============================================================================
// Type Definitions
// ============================================================================

export interface PeriodData {
  income: number;
  expense: number;
  netProfit: number;
  transactionCount: number;
}

export interface TimePeriodFinancials {
  today: PeriodData;
  week: PeriodData;
  month: PeriodData;
  all: PeriodData;
}

export type AnomalyType = 'abnormal_income' | 'abnormal_expense' | 'high_frequency' | 'large_transaction';
export type AnomalySeverity = 'high' | 'medium' | 'low';
export type RiskLevel = 'high' | 'medium' | 'low' | 'normal';

export interface AnomalyAlert {
  type: AnomalyType;
  severity: AnomalySeverity;
  score: number;
  details: any;
}

export interface AnomalyStatistics {
  recentIncome: number;
  recentExpense: number;
  recentCount: number;
  avgIncome: number;
  avgExpense: number;
  avgCount: number;
  largeTransactionCount: number;
}

export interface AnomalyData {
  riskScore: number;
  riskLevel: RiskLevel;
  alerts: AnomalyAlert[];
  statistics: AnomalyStatistics;
}

export interface RiskLevelInfo {
  level: RiskLevel;
  emoji: string;
  label: string;
  color: string;
}

// ============================================================================
// Risk Level Mapping
// ============================================================================

/**
 * Maps a risk score to a risk level with associated display information
 * 
 * @param score - Risk score (0-100)
 * @returns Risk level information including emoji and label
 * 
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5
 */
export function getRiskLevel(score: number): RiskLevelInfo {
  if (score >= 80) {
    return {
      level: 'high',
      emoji: '🚨',
      label: '高風險',
      color: 'red'
    };
  }
  
  if (score >= 50) {
    return {
      level: 'medium',
      emoji: '⚠️',
      label: '中風險',
      color: 'yellow'
    };
  }
  
  if (score >= 30) {
    return {
      level: 'low',
      emoji: '💡',
      label: '低風險',
      color: 'blue'
    };
  }
  
  return {
    level: 'normal',
    emoji: '✅',
    label: '正常',
    color: 'green'
  };
}

// ============================================================================
// Anomaly Scoring
// ============================================================================

export interface AnomalyScoreInput {
  recentIncome: number;
  recentExpense: number;
  recentCount: number;
  avgIncome: number;
  avgExpense: number;
  avgCount: number;
  largeTransactions: number;
}

/**
 * Calculates an anomaly score based on financial activity patterns
 * 
 * Scoring breakdown:
 * - Abnormal income: max 30 points
 * - Abnormal expense: max 30 points
 * - High frequency: max 20 points
 * - Large transactions: max 15 points
 * - Historical comparison: max 25 points
 * 
 * @param data - Financial activity data
 * @returns Total anomaly score (0-100)
 * 
 * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5
 */
export function calculateAnomalyScore(data: AnomalyScoreInput): number {
  let score = 0;
  
  // Abnormal income (max 30 points)
  // Requirement 14.1: Score abnormal income
  if (data.recentIncome > 100000) {
    score += 30;
  } else if (data.recentIncome > 50000) {
    score += 20;
  } else if (data.recentIncome > 30000) {
    score += 10;
  }
  
  // Abnormal expense (max 30 points)
  // Requirement 14.2: Score abnormal expense
  if (data.recentExpense > 100000) {
    score += 30;
  } else if (data.recentExpense > 50000) {
    score += 20;
  } else if (data.recentExpense > 30000) {
    score += 10;
  }
  
  // High frequency (max 20 points)
  // Requirement 14.3: Score high frequency
  if (data.recentCount > 50) {
    score += 20;
  } else if (data.recentCount > 30) {
    score += 15;
  } else if (data.recentCount > 20) {
    score += 10;
  }
  
  // Large transactions (max 15 points)
  // Requirement 14.4: Score large transactions
  if (data.largeTransactions > 0) {
    score += Math.min(15, data.largeTransactions * 5);
  }
  
  // Historical comparison (max 25 points)
  // Requirement 14.5: Score historical comparison
  const incomeMultiplier = data.avgIncome > 0 ? data.recentIncome / data.avgIncome : 0;
  const expenseMultiplier = data.avgExpense > 0 ? data.recentExpense / data.avgExpense : 0;
  const countMultiplier = data.avgCount > 0 ? data.recentCount / data.avgCount : 0;
  
  const maxMultiplier = Math.max(incomeMultiplier, expenseMultiplier, countMultiplier);
  
  if (maxMultiplier >= 3) {
    score += 25;
  } else if (maxMultiplier >= 2) {
    score += 15;
  } else if (maxMultiplier >= 1.5) {
    score += 8;
  }
  
  // Cap at 100
  return Math.min(100, score);
}

// ============================================================================
// Anomaly Detection
// ============================================================================

/**
 * Detects financial anomalies and generates alerts
 * 
 * This function analyzes financial activity data and creates specific
 * anomaly alerts based on various patterns:
 * - Abnormal income levels
 * - Abnormal expense levels
 * - High transaction frequency
 * - Large individual transactions
 * 
 * @param statistics - Financial activity statistics
 * @returns Complete anomaly data with risk score and alerts
 * 
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5
 */
export function detectAnomalies(statistics: AnomalyStatistics): AnomalyData {
  const alerts: AnomalyAlert[] = [];
  
  // Detect abnormal income (Requirement 11.1)
  if (statistics.recentIncome > 100000) {
    alerts.push({
      type: 'abnormal_income',
      severity: 'high',
      score: 30,
      details: {
        amount: statistics.recentIncome,
        threshold: 100000,
        avgIncome: statistics.avgIncome
      }
    });
  } else if (statistics.recentIncome > 50000) {
    alerts.push({
      type: 'abnormal_income',
      severity: 'medium',
      score: 20,
      details: {
        amount: statistics.recentIncome,
        threshold: 50000,
        avgIncome: statistics.avgIncome
      }
    });
  }
  
  // Detect abnormal expense (Requirement 11.2)
  if (statistics.recentExpense > 100000) {
    alerts.push({
      type: 'abnormal_expense',
      severity: 'high',
      score: 30,
      details: {
        amount: statistics.recentExpense,
        threshold: 100000,
        avgExpense: statistics.avgExpense
      }
    });
  } else if (statistics.recentExpense > 50000) {
    alerts.push({
      type: 'abnormal_expense',
      severity: 'medium',
      score: 20,
      details: {
        amount: statistics.recentExpense,
        threshold: 50000,
        avgExpense: statistics.avgExpense
      }
    });
  }
  
  // Detect high frequency (Requirement 11.3)
  if (statistics.recentCount > 50) {
    alerts.push({
      type: 'high_frequency',
      severity: 'high',
      score: 20,
      details: {
        count: statistics.recentCount,
        threshold: 50,
        avgCount: statistics.avgCount
      }
    });
  } else if (statistics.recentCount > 30) {
    alerts.push({
      type: 'high_frequency',
      severity: 'medium',
      score: 15,
      details: {
        count: statistics.recentCount,
        threshold: 30,
        avgCount: statistics.avgCount
      }
    });
  }
  
  // Detect large transactions (Requirement 11.4)
  if (statistics.largeTransactionCount > 0) {
    const severity: AnomalySeverity = statistics.largeTransactionCount >= 3 ? 'high' : 
                                       statistics.largeTransactionCount >= 2 ? 'medium' : 'low';
    alerts.push({
      type: 'large_transaction',
      severity,
      score: Math.min(15, statistics.largeTransactionCount * 5),
      details: {
        count: statistics.largeTransactionCount,
        threshold: 50000
      }
    });
  }
  
  // Calculate overall risk score
  const riskScore = calculateAnomalyScore({
    recentIncome: statistics.recentIncome,
    recentExpense: statistics.recentExpense,
    recentCount: statistics.recentCount,
    avgIncome: statistics.avgIncome,
    avgExpense: statistics.avgExpense,
    avgCount: statistics.avgCount,
    largeTransactions: statistics.largeTransactionCount
  });
  
  const riskLevelInfo = getRiskLevel(riskScore);
  
  return {
    riskScore,
    riskLevel: riskLevelInfo.level,
    alerts,
    statistics
  };
}

// ============================================================================
// Command Classification
// ============================================================================

export type CommandCategory = 'game' | 'trading' | 'query' | 'admin' | 'social' | 'other';

export interface CommandCategoryConfig {
  emoji: string;
  keywords: string[];
  name: string;
}

export interface CommandUsage {
  commandName: string;
  count: number;
}

export interface CommandCategoryStats {
  category: CommandCategory;
  emoji: string;
  name: string;
  count: number;
  percentage: number;
  topCommands: Array<{ name: string; count: number }>;
}

export interface CommandTypeAnalysis {
  categories: CommandCategoryStats[];
  totalCommands: number;
  hasConcentration: boolean;
  concentratedCategory?: CommandCategory;
}

/**
 * Command category definitions with keywords for classification
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */
export const COMMAND_CATEGORIES: Record<CommandCategory, CommandCategoryConfig> = {
  game: {
    emoji: '🎮',
    keywords: ['gacha', 'roll', 'odog', 'wish', 'draw', 'pull', 'summon'],
    name: '遊戲類'
  },
  trading: {
    emoji: '💰',
    keywords: ['transfer', 'trade', 'buy', 'sell', 'exchange', 'swap'],
    name: '交易類'
  },
  query: {
    emoji: '🔍',
    keywords: ['info', 'check', 'view', 'list', 'search', 'find', 'show'],
    name: '查詢類'
  },
  admin: {
    emoji: '⚙️',
    keywords: ['config', 'set', 'admin', 'manage', 'setup', 'configure'],
    name: '管理類'
  },
  social: {
    emoji: '💬',
    keywords: ['message', 'reply', 'react', 'chat', 'talk'],
    name: '社交類'
  },
  other: {
    emoji: '📦',
    keywords: [],
    name: '其他'
  }
};

/**
 * Classifies a command into a category based on its name
 * 
 * @param commandName - Name of the command to classify
 * @returns Category name
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */
export function classifyCommand(commandName: string): CommandCategory {
  const lowerName = commandName.toLowerCase();
  
  for (const [category, config] of Object.entries(COMMAND_CATEGORIES)) {
    if (config.keywords.some(keyword => lowerName.includes(keyword))) {
      return category as CommandCategory;
    }
  }
  
  return 'other';
}

/**
 * Analyzes command usage by type/category
 * 
 * This function:
 * - Classifies all commands into categories
 * - Calculates usage count and percentage per category
 * - Identifies top 3 commands per category
 * - Detects concentration (>70% in one category)
 * 
 * @param commands - Array of command usage data
 * @returns Structured command type analysis
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */
export function analyzeCommandTypes(commands: CommandUsage[]): CommandTypeAnalysis {
  // Calculate total command count
  const totalCommands = commands.reduce((sum, cmd) => sum + cmd.count, 0);
  
  if (totalCommands === 0) {
    return {
      categories: [],
      totalCommands: 0,
      hasConcentration: false
    };
  }
  
  // Group commands by category
  const categoryMap = new Map<CommandCategory, CommandUsage[]>();
  
  for (const cmd of commands) {
    const category = classifyCommand(cmd.commandName);
    if (!categoryMap.has(category)) {
      categoryMap.set(category, []);
    }
    categoryMap.get(category)!.push(cmd);
  }
  
  // Build category statistics
  const categories: CommandCategoryStats[] = [];
  let maxPercentage = 0;
  let concentratedCategory: CommandCategory | undefined;
  
  for (const [category, categoryCommands] of categoryMap.entries()) {
    const config = COMMAND_CATEGORIES[category];
    const count = categoryCommands.reduce((sum, cmd) => sum + cmd.count, 0);
    const percentage = (count / totalCommands) * 100;
    
    // Get top 3 commands for this category
    const topCommands = categoryCommands
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(cmd => ({ name: cmd.commandName, count: cmd.count }));
    
    categories.push({
      category,
      emoji: config.emoji,
      name: config.name,
      count,
      percentage,
      topCommands
    });
    
    // Track concentration
    if (percentage > maxPercentage) {
      maxPercentage = percentage;
      concentratedCategory = category;
    }
  }
  
  // Sort categories by count (descending)
  categories.sort((a, b) => b.count - a.count);
  
  // Detect concentration (>70% in one category) - Requirement 6.4
  const hasConcentration = maxPercentage > 70;
  
  return {
    categories,
    totalCommands,
    hasConcentration,
    concentratedCategory: hasConcentration ? concentratedCategory : undefined
  };
}

// ============================================================================
// Data Validation Functions (Task 11.4)
// ============================================================================

/**
 * Validates financial data before processing
 * 
 * Checks for:
 * - Negative values where inappropriate
 * - Unrealistic values (> 1 billion)
 * - Invalid data types
 * 
 * @param data - Financial data to validate
 * @returns True if data is valid, false otherwise
 * 
 * Requirements: 15.3
 */
export function validateFinancialData(data: {
  income?: number;
  expense?: number;
  netProfit?: number;
  transactionCount?: number;
}): boolean {
  // Check for null or undefined
  if (!data) return false;
  
  // Check for negative values where they shouldn't exist (income, expense, count)
  if (data.income !== undefined && data.income < 0) return false;
  if (data.expense !== undefined && data.expense < 0) return false;
  if (data.transactionCount !== undefined && data.transactionCount < 0) return false;
  
  // Check for unrealistic values (> 1 billion)
  const MAX_REALISTIC_VALUE = 1000000000;
  if (data.income !== undefined && data.income > MAX_REALISTIC_VALUE) return false;
  if (data.expense !== undefined && data.expense > MAX_REALISTIC_VALUE) return false;
  
  // Check for NaN values
  if (data.income !== undefined && isNaN(data.income)) return false;
  if (data.expense !== undefined && isNaN(data.expense)) return false;
  if (data.netProfit !== undefined && isNaN(data.netProfit)) return false;
  if (data.transactionCount !== undefined && isNaN(data.transactionCount)) return false;
  
  return true;
}

/**
 * Validates anomaly statistics data
 * 
 * @param statistics - Anomaly statistics to validate (from database types)
 * @returns True if data is valid, false otherwise
 * 
 * Requirements: 15.3
 */
export function validateAnomalyStatistics(statistics: any): boolean {
  if (!statistics) return false;
  
  // Validate all numeric fields
  const numericFields = [
    statistics.recentIncome,
    statistics.recentExpense,
    statistics.recentCount,
    statistics.avgDailyIncome,
    statistics.avgDailyExpense,
    statistics.avgDailyCount,
  ];
  
  for (const value of numericFields) {
    if (typeof value !== 'number' || isNaN(value) || value < 0) {
      return false;
    }
  }
  
  // Validate arrays exist
  if (!Array.isArray(statistics.largeTransactions)) return false;
  if (!Array.isArray(statistics.topIncomePartners)) return false;
  if (!Array.isArray(statistics.topExpensePartners)) return false;
  
  return true;
}

/**
 * Sanitizes financial data by clamping values to reasonable ranges
 * 
 * @param value - Value to sanitize
 * @param min - Minimum allowed value (default: 0)
 * @param max - Maximum allowed value (default: 1 billion)
 * @returns Sanitized value
 * 
 * Requirements: 15.3
 */
export function sanitizeFinancialValue(
  value: number,
  min: number = 0,
  max: number = 1000000000
): number {
  if (isNaN(value)) return 0;
  return Math.max(min, Math.min(max, value));
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Formats a risk level for display
 * 
 * @param riskLevel - Risk level information
 * @returns Formatted string with emoji and label
 */
export function formatRiskLevel(riskLevel: RiskLevelInfo): string {
  return `${riskLevel.emoji} ${riskLevel.label}`;
}

/**
 * Gets alert count by severity
 * 
 * @param alerts - Array of anomaly alerts
 * @param severity - Severity level to count
 * @returns Number of alerts with the specified severity
 */
export function getAlertCountBySeverity(alerts: AnomalyAlert[], severity: AnomalySeverity): number {
  return alerts.filter(alert => alert.severity === severity).length;
}

/**
 * Gets alerts by type
 * 
 * @param alerts - Array of anomaly alerts
 * @param type - Anomaly type to filter
 * @returns Array of alerts matching the specified type
 */
export function getAlertsByType(alerts: AnomalyAlert[], type: AnomalyType): AnomalyAlert[] {
  return alerts.filter(alert => alert.type === type);
}
