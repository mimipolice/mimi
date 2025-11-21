/**
 * Financial Content Generators
 * 
 * This module contains all content generation functions related to financial
 * analysis and reporting, including financial overview, time period analysis,
 * income/expense breakdowns, and investment portfolio views.
 * 
 * Requirements: 1.1, 1.3, 1.4, 2.1, 2.2, 4.2, 4.5, 5.2, 5.3
 */

import { ContentGeneratorOptions } from "./types";
import {
  formatBreakdown,
  formatPortfolio,
  formatTimePeriodTable,
  formatProfitRate,
  formatLargeNumber,
  createProgressBar,
} from "../formatters";
import {
  formatRiskLevel as formatRiskLevelUtil,
  getRiskLevel,
} from "../financial-analyzer";

/**
 * Helper function to get appropriate "no data" message
 * 
 * Requirements: 15.1, 15.2, 15.5
 */
function getNoDataMessage(dataType: 'transactions' | 'commands' | 'activity' | 'financial'): string {
  const messages = {
    transactions: '📭 無交易記錄',
    commands: '📭 無使用記錄',
    activity: '📭 資料不足',
    financial: '📭 無財務資料'
  };
  
  return messages[dataType] || '📭 資料不可用';
}

/**
 * 生成財務總覽內容 (Legacy)
 * 
 * This is the original financial overview function that displays
 * account balance, transaction statistics, spending/income breakdown,
 * and investment portfolio.
 * 
 * Requirements: 1.1, 1.3, 2.1, 2.2
 */
export function createFinancialContent(
  options: ContentGeneratorOptions
): string {
  const { targetUser, userInfo } = options;

  const portfolioContent = formatPortfolio(userInfo.portfolio);
  const netIncome = userInfo.total_received - userInfo.total_spent;
  const netIncomeEmoji = netIncome > 0 ? "📈" : netIncome < 0 ? "📉" : "➖";

  return (
    `# 💰 ${targetUser.username} 的財務總覽\n\n` +
    `## 💳 帳戶餘額\n` +
    `- 💵 油幣: **${userInfo.oil_balance.toLocaleString()}** 元\n` +
    `- 🎫 油票: **${userInfo.oil_ticket_balance.toLocaleString()}** 張\n\n` +
    `## 💸 交易統計\n` +
    `- 📥 總轉入: **${userInfo.total_received.toLocaleString()}** 元\n` +
    `- 📤 總轉出: **${userInfo.total_spent.toLocaleString()}** 元\n` +
    `- ${netIncomeEmoji} 淨收入: **${netIncome.toLocaleString()}** 元\n` +
    `- 🔢 交易次數: **${userInfo.total_transactions_count.toLocaleString()}** 次\n\n` +
    `## 🧾 主要支出項目\n${formatBreakdown(userInfo.spending_breakdown, "支出")}\n\n` +
    `## 📈 主要收入來源\n${formatBreakdown(userInfo.income_breakdown, "收入")}\n\n` +
    `## 📊 股票投資組合\n${portfolioContent}`
  );
}

/**
 * Task 5.1: 生成財務總覽內容
 * 
 * 顯示帳戶餘額、總收支、淨利和異常警報摘要
 * 
 * Requirements: 9.1
 * Task 11.2: 處理缺少資料的情況
 */
export function createFinancialOverviewContent(
  options: ContentGeneratorOptions
): string {
  const { targetUser, userInfo, anomalyData } = options;

  let content = `# 💰 ${targetUser.username} 的財務總覽\n\n`;
  content += `> 📍 財務總覽 > 總覽\n\n`;

  // Task 11.2: 檢查是否有使用者資料
  if (!userInfo) {
    content += getNoDataMessage('financial');
    return content;
  }

  const netIncome = userInfo.total_received - userInfo.total_spent;
  const netIncomeEmoji = netIncome > 0 ? "📈" : netIncome < 0 ? "📉" : "➖";

  // 帳戶餘額
  content += `## 💳 帳戶餘額\n`;
  content += `- 💵 油幣: **${userInfo.oil_balance.toLocaleString()}** 元\n`;
  content += `- 🎫 油票: **${userInfo.oil_ticket_balance.toLocaleString()}** 張\n\n`;

  // 交易統計
  content += `## 💸 交易統計\n`;
  content += `- 📥 總收入: **${userInfo.total_received.toLocaleString()}** 元\n`;
  content += `- 📤 總支出: **${userInfo.total_spent.toLocaleString()}** 元\n`;
  content += `- ${netIncomeEmoji} 淨利: **${netIncome.toLocaleString()}** 元\n`;
  content += `- 🔢 交易次數: **${userInfo.total_transactions_count.toLocaleString()}** 次\n\n`;

  // 異常警報摘要（如果有）
  if (anomalyData && anomalyData.riskScore > 0) {
    const riskLevelInfo = getRiskLevel(anomalyData.riskScore);
    content += `## 🚨 異常活動警報\n`;
    content += `- 風險等級: ${formatRiskLevelUtil(riskLevelInfo)} (${anomalyData.riskScore}/100)\n`;
    
    // 計算警報數量
    let highAlerts = 0;
    let mediumAlerts = 0;
    let lowAlerts = 0;

    if (anomalyData.statistics.recentIncome > 100000) highAlerts++;
    else if (anomalyData.statistics.recentIncome > 50000) mediumAlerts++;
    else if (anomalyData.statistics.recentIncome > 30000) lowAlerts++;

    if (anomalyData.statistics.recentExpense > 100000) highAlerts++;
    else if (anomalyData.statistics.recentExpense > 50000) mediumAlerts++;
    else if (anomalyData.statistics.recentExpense > 30000) lowAlerts++;

    if (anomalyData.statistics.recentCount > 50) highAlerts++;
    else if (anomalyData.statistics.recentCount > 30) mediumAlerts++;
    else if (anomalyData.statistics.recentCount > 20) lowAlerts++;

    if (anomalyData.statistics.largeTransactions.length >= 3) highAlerts++;
    else if (anomalyData.statistics.largeTransactions.length >= 2) mediumAlerts++;
    else if (anomalyData.statistics.largeTransactions.length === 1) lowAlerts++;
    
    content += `- 🚨 高風險警報: ${highAlerts} 個\n`;
    content += `- ⚠️ 中風險警報: ${mediumAlerts} 個\n`;
    content += `- 💡 低風險警報: ${lowAlerts} 個\n`;
    content += `\n> 💡 選擇「異常活動檢測」查看詳細資訊\n\n`;
  }

  return content;
}

/**
 * Task 5.2: 生成時間段分析內容
 * 
 * 創建時間段對比表格，顯示今日/本週/本月/總計的淨利對比
 * 
 * Requirements: 9.2
 * Task 11.2: 處理缺少資料的情況
 */
export function createTimePeriodAnalysisContent(
  options: ContentGeneratorOptions
): string {
  const { targetUser, timePeriodFinancials } = options;

  let content = `# 💹 ${targetUser.username} 的時間段分析\n\n`;
  content += `> 📍 財務總覽 > 時間段分析\n\n`;

  // Task 11.2: 檢查是否有時間段財務資料
  if (!timePeriodFinancials) {
    content += `正在載入資料...\n`;
    return content;
  }

  // Task 11.2: 檢查是否所有時間段都沒有交易
  const hasAnyTransactions = timePeriodFinancials.today.transactionCount > 0 ||
                             timePeriodFinancials.week.transactionCount > 0 ||
                             timePeriodFinancials.month.transactionCount > 0 ||
                             timePeriodFinancials.all.transactionCount > 0;

  if (!hasAnyTransactions) {
    content += getNoDataMessage('transactions');
    return content;
  }

  content += `## 📊 時間段對比\n\n`;
  content += formatTimePeriodTable(timePeriodFinancials);

  // 添加趨勢分析
  content += `\n## 📈 趨勢分析\n`;
  
  const todayRate = formatProfitRate(
    timePeriodFinancials.today.netProfit,
    timePeriodFinancials.today.income
  );
  const weekRate = formatProfitRate(
    timePeriodFinancials.week.netProfit,
    timePeriodFinancials.week.income
  );
  const monthRate = formatProfitRate(
    timePeriodFinancials.month.netProfit,
    timePeriodFinancials.month.income
  );
  const allRate = formatProfitRate(
    timePeriodFinancials.all.netProfit,
    timePeriodFinancials.all.income
  );

  content += `- **今日淨利率**: ${todayRate}\n`;
  content += `- **本週淨利率**: ${weekRate}\n`;
  content += `- **本月淨利率**: ${monthRate}\n`;
  content += `- **總淨利率**: ${allRate}\n`;

  return content;
}

/**
 * Task 5.3: 生成收入分析內容
 * 
 * 顯示收入來源的詳細分類和 Top 10
 * 
 * Requirements: 9.4
 * Task 11.2: 處理缺少資料的情況
 */
export function createIncomeAnalysisContent(
  options: ContentGeneratorOptions
): string {
  const { targetUser, userInfo } = options;

  let content = `# 📈 ${targetUser.username} 的收入分析\n\n`;
  content += `> 📍 財務總覽 > 收入分析\n\n`;

  // Task 11.2: 檢查是否有使用者資料
  if (!userInfo) {
    content += getNoDataMessage('financial');
    return content;
  }

  content += `## 💰 總收入統計\n`;
  content += `- 總收入: **${userInfo.total_received.toLocaleString()}** 元\n\n`;

  // Task 11.2: 檢查是否有收入記錄
  if (!userInfo.income_breakdown || userInfo.income_breakdown.length === 0) {
    content += `## 📊 收入來源分類\n`;
    content += getNoDataMessage('transactions');
    return content;
  }

  content += `## 📊 收入來源分類\n`;
  content += formatBreakdown(userInfo.income_breakdown, "收入");

  return content;
}

/**
 * Task 5.4: 生成支出分析內容
 * 
 * 顯示支出項目的詳細分類和 Top 10
 * 
 * Requirements: 9.5
 * Task 11.2: 處理缺少資料的情況
 */
export function createExpenseAnalysisContent(
  options: ContentGeneratorOptions
): string {
  const { targetUser, userInfo } = options;

  let content = `# 📉 ${targetUser.username} 的支出分析\n\n`;
  content += `> 📍 財務總覽 > 支出分析\n\n`;

  // Task 11.2: 檢查是否有使用者資料
  if (!userInfo) {
    content += getNoDataMessage('financial');
    return content;
  }

  content += `## 💸 總支出統計\n`;
  content += `- 總支出: **${userInfo.total_spent.toLocaleString()}** 元\n\n`;

  // Task 11.2: 檢查是否有支出記錄
  if (!userInfo.spending_breakdown || userInfo.spending_breakdown.length === 0) {
    content += `## 📊 支出項目分類\n`;
    content += getNoDataMessage('transactions');
    return content;
  }

  content += `## 📊 支出項目分類\n`;
  content += formatBreakdown(userInfo.spending_breakdown, "支出");

  return content;
}

/**
 * Task 5.5: 生成投資組合內容
 * 
 * 顯示股票持倉的詳細資訊和市值分析
 * 
 * Requirements: 9.6
 * Task 11.2: 處理缺少資料的情況
 */
export function createPortfolioContent(
  options: ContentGeneratorOptions
): string {
  const { targetUser, userInfo } = options;

  let content = `# 💼 ${targetUser.username} 的投資組合\n\n`;
  content += `> 📍 財務總覽 > 投資組合\n\n`;

  // Task 11.2: 檢查是否有使用者資料
  if (!userInfo) {
    content += getNoDataMessage('financial');
    return content;
  }

  // Task 11.2: 檢查是否有投資組合
  if (!userInfo.portfolio || userInfo.portfolio.length === 0) {
    content += `## 📊 股票持倉\n`;
    content += `目前無持有股票。\n`;
    return content;
  }

  const totalValue = userInfo.portfolio.reduce((sum, item) => sum + item.total_value, 0);

  content += `## 📊 投資組合總覽\n`;
  content += `- 總市值: **${totalValue.toLocaleString()}** 元\n`;
  content += `- 持有股票數: **${userInfo.portfolio.length}** 檔\n\n`;

  content += `## 📈 持倉明細 (Top 15)\n\n`;

  const sortedPortfolio = [...userInfo.portfolio]
    .sort((a, b) => b.total_value - a.total_value)
    .slice(0, 15);

  sortedPortfolio.forEach((item, i) => {
    // Task 11.3: 處理除以零的情況
    const percentage = totalValue > 0 ? ((item.total_value / totalValue) * 100).toFixed(1) : '0.0';
    const bar = createProgressBar(parseFloat(percentage), 15);
    
    content += `**${i + 1}. ${item.asset_name}**\n`;
    content += `   持有: ${item.quantity} 股 | 市值: ${item.total_value.toLocaleString()} 元\n`;
    content += `   佔比: ${percentage}% ${bar}\n\n`;
  });

  if (userInfo.portfolio.length > 15) {
    content += `... 還有 ${userInfo.portfolio.length - 15} 檔股票\n`;
  }

  return content;
}
