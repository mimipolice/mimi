/**
 * Details Content Generators
 * 
 * This module contains content generators for detailed transaction records
 * and interaction rankings in the user-info command.
 * 
 * Functions:
 * - createDetailsContent: Generate detailed transaction records with pagination
 * - createInteractionsContent: Generate interaction rankings (top senders/receivers)
 * 
 * Requirements: 1.1, 1.3, 1.4, 2.1, 2.2, 4.2, 4.5, 5.2, 5.3
 */

import { formatTransactions, formatInteractionList } from "../formatters";
import { ContentGeneratorOptions } from "./types";

/**
 * Generate detailed transaction records content
 * 
 * Displays recent transactions with pagination support and card collection overview.
 * 
 * @param options - Content generator options including user info and transactions
 * @returns Formatted content string for detailed records view
 */
export function createDetailsContent(options: ContentGeneratorOptions): string {
  const { targetUser, userInfo, recentTransactions, transactionPage = 0 } = options;

  // Pagination handling
  const pageSize = 5;
  const totalPages = Math.ceil(recentTransactions.length / pageSize);
  const startIndex = transactionPage * pageSize;
  const endIndex = startIndex + pageSize;
  const pagedTransactions = recentTransactions.slice(startIndex, endIndex);

  const recentTransactionsContent = formatTransactions(
    pagedTransactions,
    targetUser.id
  );

  let content = `# 📝 ${targetUser.username} 的詳細記錄\n\n`;
  content += `## 💳 最近交易紀錄 (第 ${transactionPage + 1}/${totalPages} 頁)\n`;
  content += `> 💡 提示：使用下方按鈕翻頁查看更多交易記錄\n\n`;
  content += recentTransactionsContent;
  content += `\n\n## 🃏 卡片收藏總覽\n`;
  content += `- 總持有卡片數量: **${userInfo.total_cards}** 張`;

  return content;
}

/**
 * Generate interaction rankings content
 * 
 * Displays top senders (people who transfer to the user) and top receivers
 * (people the user transfers to), with sorting options by amount or count.
 * 
 * @param options - Content generator options including interaction data
 * @returns Formatted content string for interactions view
 */
export function createInteractionsContent(
  options: ContentGeneratorOptions
): string {
  const { targetUser, userInfo, interactionSortBy = "amount" } = options;

  const topSendersContent = formatInteractionList(
    userInfo.top_senders,
    "sender",
    interactionSortBy
  );
  const topReceiversContent = formatInteractionList(
    userInfo.top_receivers,
    "receiver",
    interactionSortBy
  );

  return (
    `# 🤝 ${targetUser.username} 的互動排行\n\n` +
    `> 💡 提示：使用下方按鈕切換排序方式（金額/次數）\n\n` +
    `## 🎁 最常轉帳給您的人 (Top 10)\n${topSendersContent}\n\n` +
    `## 💸 您最常轉帳的人 (Top 10)\n${topReceiversContent}`
  );
}
