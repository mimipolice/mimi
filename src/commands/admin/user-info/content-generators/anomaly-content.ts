/**
 * Anomaly Detection Content Generators
 * 
 * This module contains content generation functions for anomaly detection views.
 * It provides detailed analysis of abnormal financial activities including:
 * - Anomaly overview with risk assessment
 * - Abnormal income analysis
 * - Abnormal expense analysis
 * - High-frequency trading detection
 * - Large transaction monitoring
 * - Time-based comparison analysis
 * 
 * Requirements: 1.1, 1.3, 1.4, 2.1, 2.2, 4.2, 4.5, 5.2, 5.3
 */

import { ContentGeneratorOptions } from "./types";
import {
  formatLargeNumber,
  createProgressBar,
} from "../formatters";
import {
  getRiskLevel,
  formatRiskLevel as formatRiskLevelUtil,
} from "../financial-analyzer";

/**
 * Task 6.1: 生成異常活動總覽內容
 * 
 * 顯示風險評分、警報摘要和快速統計
 * 
 * Requirements: 10.1
 */
export function createAnomalyOverviewContent(
  options: ContentGeneratorOptions
): string {
  const { targetUser, anomalyData } = options;

  let content = `# 🚨 ${targetUser.username} 的異常活動檢測\n\n`;
  content += `> 📍 財務總覽 > 異常活動檢測 > 總覽\n\n`;

  if (!anomalyData) {
    content += `正在載入資料...\n`;
    return content;
  }

  const riskLevelInfo = getRiskLevel(anomalyData.riskScore);
  
  // 風險評分
  content += `## 📊 風險評估\n`;
  content += `- **風險等級**: ${formatRiskLevelUtil(riskLevelInfo)}\n`;
  content += `- **風險分數**: ${anomalyData.riskScore}/100\n\n`;

  // 警報摘要 - 基於統計數據計算
  let highAlerts = 0;
  let mediumAlerts = 0;
  let lowAlerts = 0;

  // 檢查異常收入
  if (anomalyData.statistics.recentIncome > 100000) {
    highAlerts++;
  } else if (anomalyData.statistics.recentIncome > 50000) {
    mediumAlerts++;
  } else if (anomalyData.statistics.recentIncome > 30000) {
    lowAlerts++;
  }

  // 檢查異常支出
  if (anomalyData.statistics.recentExpense > 100000) {
    highAlerts++;
  } else if (anomalyData.statistics.recentExpense > 50000) {
    mediumAlerts++;
  } else if (anomalyData.statistics.recentExpense > 30000) {
    lowAlerts++;
  }

  // 檢查高頻交易
  if (anomalyData.statistics.recentCount > 50) {
    highAlerts++;
  } else if (anomalyData.statistics.recentCount > 30) {
    mediumAlerts++;
  } else if (anomalyData.statistics.recentCount > 20) {
    lowAlerts++;
  }

  // 檢查大額交易
  if (anomalyData.statistics.largeTransactions.length >= 3) {
    highAlerts++;
  } else if (anomalyData.statistics.largeTransactions.length >= 2) {
    mediumAlerts++;
  } else if (anomalyData.statistics.largeTransactions.length === 1) {
    lowAlerts++;
  }

  const totalAlerts = highAlerts + mediumAlerts + lowAlerts;

  content += `## 🔔 警報摘要\n`;
  content += `- 🚨 高風險警報: **${highAlerts}** 個\n`;
  content += `- ⚠️ 中風險警報: **${mediumAlerts}** 個\n`;
  content += `- 💡 低風險警報: **${lowAlerts}** 個\n`;
  content += `- 📋 總警報數: **${totalAlerts}** 個\n\n`;

  // 快速統計（24小時 vs 歷史平均）
  content += `## 📈 快速統計 (最近24小時)\n`;
  content += `### 收入\n`;
  content += `- 最近24小時: **${formatLargeNumber(anomalyData.statistics.recentIncome)}** 元\n`;
  content += `- 歷史平均: **${formatLargeNumber(Math.round(anomalyData.statistics.avgDailyIncome))}** 元/天\n`;
  const incomeMultiplier = anomalyData.statistics.avgDailyIncome > 0 
    ? (anomalyData.statistics.recentIncome / anomalyData.statistics.avgDailyIncome).toFixed(1)
    : 'N/A';
  content += `- 倍數: **${incomeMultiplier}x**\n\n`;

  content += `### 支出\n`;
  content += `- 最近24小時: **${formatLargeNumber(anomalyData.statistics.recentExpense)}** 元\n`;
  content += `- 歷史平均: **${formatLargeNumber(Math.round(anomalyData.statistics.avgDailyExpense))}** 元/天\n`;
  const expenseMultiplier = anomalyData.statistics.avgDailyExpense > 0 
    ? (anomalyData.statistics.recentExpense / anomalyData.statistics.avgDailyExpense).toFixed(1)
    : 'N/A';
  content += `- 倍數: **${expenseMultiplier}x**\n\n`;

  content += `### 交易頻率\n`;
  content += `- 最近24小時: **${anomalyData.statistics.recentCount}** 次\n`;
  content += `- 歷史平均: **${Math.round(anomalyData.statistics.avgDailyCount)}** 次/天\n`;
  const countMultiplier = anomalyData.statistics.avgDailyCount > 0 
    ? (anomalyData.statistics.recentCount / anomalyData.statistics.avgDailyCount).toFixed(1)
    : 'N/A';
  content += `- 倍數: **${countMultiplier}x**\n\n`;

  // 導航提示
  if (totalAlerts > 0) {
    content += `> 💡 使用下方選單查看各類異常的詳細分析\n`;
  }

  return content;
}

/**
 * Task 6.2: 生成異常收入內容
 * 
 * 顯示詳細的收入分析，包含 Top 10 收入來源、時間分布、金額分布和風險評估
 * 
 * Requirements: 10.2, 11.1
 */
export function createAbnormalIncomeContent(
  options: ContentGeneratorOptions
): string {
  const { targetUser, anomalyData } = options;

  let content = `# 💰 ${targetUser.username} 的異常收入分析\n\n`;
  content += `> 📍 財務總覽 > 異常活動檢測 > 異常收入\n\n`;

  if (!anomalyData) {
    content += `正在載入資料...\n`;
    return content;
  }

  const { statistics } = anomalyData;

  // 收入總覽
  content += `## 📊 收入總覽 (最近24小時)\n`;
  content += `- 總收入: **${formatLargeNumber(statistics.recentIncome)}** 元\n`;
  content += `- 歷史平均: **${formatLargeNumber(Math.round(statistics.avgDailyIncome))}** 元/天\n`;
  
  const incomeMultiplier = statistics.avgDailyIncome > 0 
    ? (statistics.recentIncome / statistics.avgDailyIncome).toFixed(1)
    : 'N/A';
  content += `- 異常倍數: **${incomeMultiplier}x**\n\n`;

  // Top 10 收入來源
  if (statistics.topIncomePartners && statistics.topIncomePartners.length > 0) {
    content += `## 💵 Top 10 收入來源\n\n`;
    
    const totalIncome = statistics.topIncomePartners.reduce((sum, p) => sum + p.amount, 0);
    
    statistics.topIncomePartners.slice(0, 10).forEach((partner, i) => {
      const percentage = totalIncome > 0 ? ((partner.amount / totalIncome) * 100).toFixed(1) : '0.0';
      const bar = createProgressBar(parseFloat(percentage), 15);
      
      content += `**${i + 1}. <@${partner.partnerId}>**\n`;
      content += `   金額: ${formatLargeNumber(partner.amount)} 元 | 次數: ${partner.count} 次\n`;
      content += `   佔比: ${percentage}% ${bar}\n\n`;
    });
  } else {
    content += `## 💵 收入來源\n無收入記錄。\n\n`;
  }

  // 風險評估與建議
  content += `## 🎯 風險評估\n`;
  
  if (statistics.recentIncome > 100000) {
    content += `🚨 **高風險**: 24小時內收入超過 10 萬元\n\n`;
    content += `**建議行動**:\n`;
    content += `- 檢查收入來源是否合法\n`;
    content += `- 確認是否為洗錢或刷錢行為\n`;
    content += `- 查看收入來源帳號的活動記錄\n`;
    content += `- 考慮暫時凍結帳號進行調查\n`;
  } else if (statistics.recentIncome > 50000) {
    content += `⚠️ **中風險**: 24小時內收入超過 5 萬元\n\n`;
    content += `**建議行動**:\n`;
    content += `- 監控後續活動\n`;
    content += `- 檢查收入來源是否集中\n`;
    content += `- 確認交易是否符合正常模式\n`;
  } else if (statistics.recentIncome > 30000) {
    content += `💡 **低風險**: 24小時內收入略高於正常水平\n\n`;
    content += `**建議行動**:\n`;
    content += `- 持續觀察\n`;
    content += `- 記錄異常模式以供參考\n`;
  } else {
    content += `✅ **正常**: 收入水平在正常範圍內\n`;
  }

  return content;
}

/**
 * Task 6.3: 生成異常支出內容
 * 
 * 顯示詳細的支出分析，包含 Top 10 支出對象、時間分布、金額分布和風險評估
 * 
 * Requirements: 10.3, 11.2
 */
export function createAbnormalExpenseContent(
  options: ContentGeneratorOptions
): string {
  const { targetUser, anomalyData } = options;

  let content = `# 💸 ${targetUser.username} 的異常支出分析\n\n`;
  content += `> 📍 財務總覽 > 異常活動檢測 > 異常支出\n\n`;

  if (!anomalyData) {
    content += `正在載入資料...\n`;
    return content;
  }

  const { statistics } = anomalyData;

  // 支出總覽
  content += `## 📊 支出總覽 (最近24小時)\n`;
  content += `- 總支出: **${formatLargeNumber(statistics.recentExpense)}** 元\n`;
  content += `- 歷史平均: **${formatLargeNumber(Math.round(statistics.avgDailyExpense))}** 元/天\n`;
  
  const expenseMultiplier = statistics.avgDailyExpense > 0 
    ? (statistics.recentExpense / statistics.avgDailyExpense).toFixed(1)
    : 'N/A';
  content += `- 異常倍數: **${expenseMultiplier}x**\n\n`;

  // Top 10 支出對象
  if (statistics.topExpensePartners && statistics.topExpensePartners.length > 0) {
    content += `## 💳 Top 10 支出對象\n\n`;
    
    const totalExpense = statistics.topExpensePartners.reduce((sum, p) => sum + p.amount, 0);
    
    statistics.topExpensePartners.slice(0, 10).forEach((partner, i) => {
      const percentage = totalExpense > 0 ? ((partner.amount / totalExpense) * 100).toFixed(1) : '0.0';
      const bar = createProgressBar(parseFloat(percentage), 15);
      
      content += `**${i + 1}. <@${partner.partnerId}>**\n`;
      content += `   金額: ${formatLargeNumber(partner.amount)} 元 | 次數: ${partner.count} 次\n`;
      content += `   佔比: ${percentage}% ${bar}\n\n`;
    });
  } else {
    content += `## 💳 支出對象\n無支出記錄。\n\n`;
  }

  // 風險評估與建議
  content += `## 🎯 風險評估\n`;
  
  if (statistics.recentExpense > 100000) {
    content += `🚨 **高風險**: 24小時內支出超過 10 萬元\n\n`;
    content += `**建議行動**:\n`;
    content += `- 檢查支出對象是否可疑\n`;
    content += `- 確認是否為資金轉移或洗錢行為\n`;
    content += `- 查看支出對象帳號的活動記錄\n`;
    content += `- 檢查是否有循環交易模式\n`;
    content += `- 考慮暫時凍結帳號進行調查\n`;
  } else if (statistics.recentExpense > 50000) {
    content += `⚠️ **中風險**: 24小時內支出超過 5 萬元\n\n`;
    content += `**建議行動**:\n`;
    content += `- 監控後續活動\n`;
    content += `- 檢查支出對象是否集中\n`;
    content += `- 確認交易是否符合正常模式\n`;
    content += `- 注意是否有異常的資金流向\n`;
  } else if (statistics.recentExpense > 30000) {
    content += `💡 **低風險**: 24小時內支出略高於正常水平\n\n`;
    content += `**建議行動**:\n`;
    content += `- 持續觀察\n`;
    content += `- 記錄異常模式以供參考\n`;
  } else {
    content += `✅ **正常**: 支出水平在正常範圍內\n`;
  }

  return content;
}

/**
 * Task 6.4: 生成高頻交易內容
 * 
 * 顯示交易頻率分析、交易對象分布和頻率對比
 * 
 * Requirements: 10.4, 11.3
 */
export function createHighFrequencyContent(
  options: ContentGeneratorOptions
): string {
  const { targetUser, anomalyData } = options;

  let content = `# ⚡ ${targetUser.username} 的高頻交易分析\n\n`;
  content += `> 📍 財務總覽 > 異常活動檢測 > 高頻交易\n\n`;

  if (!anomalyData) {
    content += `正在載入資料...\n`;
    return content;
  }

  const { statistics } = anomalyData;

  // 交易頻率總覽
  content += `## 📊 交易頻率總覽 (最近24小時)\n`;
  content += `- 總交易次數: **${statistics.recentCount}** 次\n`;
  content += `- 歷史平均: **${Math.round(statistics.avgDailyCount)}** 次/天\n`;
  
  const countMultiplier = statistics.avgDailyCount > 0 
    ? (statistics.recentCount / statistics.avgDailyCount).toFixed(1)
    : 'N/A';
  content += `- 頻率倍數: **${countMultiplier}x**\n`;
  
  const avgPerHour = (statistics.recentCount / 24).toFixed(1);
  content += `- 平均每小時: **${avgPerHour}** 次\n\n`;

  // 交易對象分布
  const allPartners = new Map<string, { income: number; expense: number; total: number }>();
  
  // 合併收入和支出對象
  if (statistics.topIncomePartners) {
    statistics.topIncomePartners.forEach(p => {
      const existing = allPartners.get(p.partnerId) || { income: 0, expense: 0, total: 0 };
      existing.income = p.count;
      existing.total += p.count;
      allPartners.set(p.partnerId, existing);
    });
  }
  
  if (statistics.topExpensePartners) {
    statistics.topExpensePartners.forEach(p => {
      const existing = allPartners.get(p.partnerId) || { income: 0, expense: 0, total: 0 };
      existing.expense = p.count;
      existing.total += p.count;
      allPartners.set(p.partnerId, existing);
    });
  }

  if (allPartners.size > 0) {
    content += `## 👥 交易對象分布 (Top 10)\n\n`;
    
    const sortedPartners = Array.from(allPartners.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 10);
    
    sortedPartners.forEach(([partnerId, counts], i) => {
      const totalCount = counts.total;
      const percentage = statistics.recentCount > 0 
        ? ((totalCount / statistics.recentCount) * 100).toFixed(1)
        : '0.0';
      
      content += `**${i + 1}. <@${partnerId}>**\n`;
      content += `   總交易: ${totalCount} 次 (${percentage}%)\n`;
      content += `   📥 收款: ${counts.income} 次 | 📤 付款: ${counts.expense} 次\n\n`;
    });
  } else {
    content += `## 👥 交易對象分布\n無交易記錄。\n\n`;
  }

  // 風險評估
  content += `## 🎯 風險評估\n`;
  
  if (statistics.recentCount > 50) {
    content += `🚨 **高風險**: 24小時內交易超過 50 次\n\n`;
    content += `**可能原因**:\n`;
    content += `- 機器人自動交易\n`;
    content += `- 刷錢或洗錢行為\n`;
    content += `- 小帳互刷\n`;
    content += `- 異常的交易模式\n\n`;
    content += `**建議行動**:\n`;
    content += `- 檢查交易對象是否集中\n`;
    content += `- 查看是否有循環交易\n`;
    content += `- 分析交易時間間隔是否規律\n`;
    content += `- 考慮暫時限制交易功能\n`;
  } else if (statistics.recentCount > 30) {
    content += `⚠️ **中風險**: 24小時內交易超過 30 次\n\n`;
    content += `**建議行動**:\n`;
    content += `- 監控後續活動\n`;
    content += `- 檢查交易模式是否正常\n`;
    content += `- 注意是否有異常的交易頻率\n`;
  } else if (statistics.recentCount > 20) {
    content += `💡 **低風險**: 交易頻率略高於正常水平\n\n`;
    content += `**建議行動**:\n`;
    content += `- 持續觀察\n`;
    content += `- 記錄活動模式\n`;
  } else {
    content += `✅ **正常**: 交易頻率在正常範圍內\n`;
  }

  return content;
}

/**
 * Task 6.5: 生成大額交易內容
 * 
 * 列出所有大額交易（>50K），顯示時間、對象、金額和方向
 * 
 * Requirements: 10.5, 11.4
 */
export function createLargeTransactionsContent(
  options: ContentGeneratorOptions
): string {
  const { targetUser, anomalyData } = options;

  let content = `# 💎 ${targetUser.username} 的大額交易分析\n\n`;
  content += `> 📍 財務總覽 > 異常活動檢測 > 大額交易\n\n`;

  if (!anomalyData) {
    content += `正在載入資料...\n`;
    return content;
  }

  const { statistics } = anomalyData;
  const largeTransactions = statistics.largeTransactions || [];

  // 大額交易總覽
  content += `## 📊 大額交易總覽 (最近24小時)\n`;
  content += `- 大額交易數量: **${largeTransactions.length}** 筆\n`;
  content += `- 門檻金額: **50,000** 元\n`;
  
  if (largeTransactions.length > 0) {
    const totalAmount = largeTransactions.reduce((sum, tx) => sum + tx.amount, 0);
    const incomingCount = largeTransactions.filter(tx => tx.direction === 'incoming').length;
    const outgoingCount = largeTransactions.filter(tx => tx.direction === 'outgoing').length;
    
    content += `- 總金額: **${formatLargeNumber(totalAmount)}** 元\n`;
    content += `- 📥 收款: ${incomingCount} 筆 | 📤 付款: ${outgoingCount} 筆\n\n`;
  } else {
    content += `\n✅ 無大額交易記錄。\n`;
    return content;
  }

  // 大額交易列表（按金額降序排列）
  content += `## 💰 大額交易明細\n`;
  content += `> 按金額降序排列\n\n`;

  const sortedTransactions = [...largeTransactions].sort((a, b) => b.amount - a.amount);

  sortedTransactions.forEach((tx, i) => {
    const directionEmoji = tx.direction === 'incoming' ? '📥' : '📤';
    const directionText = tx.direction === 'incoming' ? '收款' : '付款';
    const timeAgo = `<t:${Math.floor(new Date(tx.createdAt).getTime() / 1000)}:R>`;
    
    content += `**${i + 1}. ${directionEmoji} ${directionText} - ${formatLargeNumber(tx.amount)} 元**\n`;
    content += `   對象: <@${tx.partnerId}>\n`;
    content += `   時間: ${timeAgo}\n\n`;
  });

  // 風險評估
  content += `## 🎯 風險評估\n`;
  
  if (largeTransactions.length >= 3) {
    content += `🚨 **高風險**: 24小時內有 ${largeTransactions.length} 筆大額交易\n\n`;
    content += `**可能原因**:\n`;
    content += `- 資金轉移或洗錢\n`;
    content += `- 帳號被盜用\n`;
    content += `- 異常的大額交易模式\n`;
    content += `- 小帳之間的資金流動\n\n`;
    content += `**建議行動**:\n`;
    content += `- 立即檢查所有交易對象\n`;
    content += `- 確認交易是否合法\n`;
    content += `- 查看是否有循環交易\n`;
    content += `- 考慮暫時凍結帳號\n`;
  } else if (largeTransactions.length >= 2) {
    content += `⚠️ **中風險**: 24小時內有 ${largeTransactions.length} 筆大額交易\n\n`;
    content += `**建議行動**:\n`;
    content += `- 檢查交易對象\n`;
    content += `- 監控後續活動\n`;
    content += `- 確認交易目的\n`;
  } else if (largeTransactions.length === 1) {
    content += `💡 **低風險**: 24小時內有 1 筆大額交易\n\n`;
    content += `**建議行動**:\n`;
    content += `- 記錄交易資訊\n`;
    content += `- 持續觀察\n`;
  }

  return content;
}

/**
 * Task 6.6: 生成時間對比內容
 * 
 * 創建詳細的時間對比表格，顯示 24h vs 7d vs 30d 平均值和倍數
 * 
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5
 */
export function createTimeComparisonContent(
  options: ContentGeneratorOptions
): string {
  const { targetUser, anomalyData } = options;

  let content = `# 📊 ${targetUser.username} 的時間對比分析\n\n`;
  content += `> 📍 財務總覽 > 異常活動檢測 > 時間對比\n\n`;

  if (!anomalyData) {
    content += `正在載入資料...\n`;
    return content;
  }

  const { statistics } = anomalyData;

  // 時間對比表格
  content += `## 📈 活動對比表\n\n`;
  content += `| 指標 | 最近24小時 | 歷史平均 | 倍數 | 狀態 |\n`;
  content += `|------|-----------|---------|------|------|\n`;

  // 收入對比
  const incomeMultiplier = statistics.avgDailyIncome > 0 
    ? (statistics.recentIncome / statistics.avgDailyIncome).toFixed(1)
    : 'N/A';
  const incomeStatus = statistics.avgDailyIncome > 0 && statistics.recentIncome / statistics.avgDailyIncome >= 3
    ? '🚨 嚴重異常'
    : statistics.avgDailyIncome > 0 && statistics.recentIncome / statistics.avgDailyIncome >= 2
    ? '⚠️ 輕度異常'
    : '✅ 正常';
  
  content += `| 💰 收入 | ${formatLargeNumber(statistics.recentIncome)} | ${formatLargeNumber(Math.round(statistics.avgDailyIncome))} | ${incomeMultiplier}x | ${incomeStatus} |\n`;

  // 支出對比
  const expenseMultiplier = statistics.avgDailyExpense > 0 
    ? (statistics.recentExpense / statistics.avgDailyExpense).toFixed(1)
    : 'N/A';
  const expenseStatus = statistics.avgDailyExpense > 0 && statistics.recentExpense / statistics.avgDailyExpense >= 3
    ? '🚨 嚴重異常'
    : statistics.avgDailyExpense > 0 && statistics.recentExpense / statistics.avgDailyExpense >= 2
    ? '⚠️ 輕度異常'
    : '✅ 正常';
  
  content += `| 💸 支出 | ${formatLargeNumber(statistics.recentExpense)} | ${formatLargeNumber(Math.round(statistics.avgDailyExpense))} | ${expenseMultiplier}x | ${expenseStatus} |\n`;

  // 交易次數對比
  const countMultiplier = statistics.avgDailyCount > 0 
    ? (statistics.recentCount / statistics.avgDailyCount).toFixed(1)
    : 'N/A';
  const countStatus = statistics.avgDailyCount > 0 && statistics.recentCount / statistics.avgDailyCount >= 3
    ? '🚨 嚴重異常'
    : statistics.avgDailyCount > 0 && statistics.recentCount / statistics.avgDailyCount >= 2
    ? '⚠️ 輕度異常'
    : '✅ 正常';
  
  content += `| 🔢 交易次數 | ${statistics.recentCount} | ${Math.round(statistics.avgDailyCount)} | ${countMultiplier}x | ${countStatus} |\n\n`;

  // 趨勢分析
  content += `## 📉 趨勢分析\n\n`;

  // 收入趨勢
  content += `### 💰 收入趨勢\n`;
  if (statistics.avgDailyIncome > 0) {
    const incomeChange = statistics.recentIncome - statistics.avgDailyIncome;
    const incomeChangePercent = ((incomeChange / statistics.avgDailyIncome) * 100).toFixed(1);
    const incomeEmoji = incomeChange > 0 ? '📈' : incomeChange < 0 ? '📉' : '➖';
    
    content += `${incomeEmoji} 相較歷史平均 ${incomeChange >= 0 ? '+' : ''}${formatLargeNumber(Math.round(incomeChange))} 元 (${incomeChangePercent}%)\n`;
    
    if (parseFloat(incomeMultiplier) >= 3) {
      content += `⚠️ 收入異常激增，建議立即調查\n`;
    } else if (parseFloat(incomeMultiplier) >= 2) {
      content += `💡 收入明顯增加，需要關注\n`;
    }
  } else {
    content += `無歷史資料可供比較\n`;
  }
  content += `\n`;

  // 支出趨勢
  content += `### 💸 支出趨勢\n`;
  if (statistics.avgDailyExpense > 0) {
    const expenseChange = statistics.recentExpense - statistics.avgDailyExpense;
    const expenseChangePercent = ((expenseChange / statistics.avgDailyExpense) * 100).toFixed(1);
    const expenseEmoji = expenseChange > 0 ? '📈' : expenseChange < 0 ? '📉' : '➖';
    
    content += `${expenseEmoji} 相較歷史平均 ${expenseChange >= 0 ? '+' : ''}${formatLargeNumber(Math.round(expenseChange))} 元 (${expenseChangePercent}%)\n`;
    
    if (parseFloat(expenseMultiplier) >= 3) {
      content += `⚠️ 支出異常激增，建議立即調查\n`;
    } else if (parseFloat(expenseMultiplier) >= 2) {
      content += `💡 支出明顯增加，需要關注\n`;
    }
  } else {
    content += `無歷史資料可供比較\n`;
  }
  content += `\n`;

  // 交易頻率趨勢
  content += `### 🔢 交易頻率趨勢\n`;
  if (statistics.avgDailyCount > 0) {
    const countChange = statistics.recentCount - statistics.avgDailyCount;
    const countChangePercent = ((countChange / statistics.avgDailyCount) * 100).toFixed(1);
    const countEmoji = countChange > 0 ? '📈' : countChange < 0 ? '📉' : '➖';
    
    content += `${countEmoji} 相較歷史平均 ${countChange >= 0 ? '+' : ''}${Math.round(countChange)} 次 (${countChangePercent}%)\n`;
    
    if (parseFloat(countMultiplier) >= 3) {
      content += `⚠️ 交易頻率異常激增，可能為機器人或刷錢行為\n`;
    } else if (parseFloat(countMultiplier) >= 2) {
      content += `💡 交易頻率明顯增加，需要關注\n`;
    }
  } else {
    content += `無歷史資料可供比較\n`;
  }

  return content;
}
