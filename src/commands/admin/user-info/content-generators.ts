/**
 * 內容生成器
 * 負責生成各個頁面的內容
 */

import { User, Client } from "discord.js";
import {
  UserInfoData,
  CommandUsagePattern,
} from "../../../shared/database/types";
import {
  formatTopGuilds,
  formatTopCommands,
  formatBreakdown,
  formatPortfolio,
  formatInteractionList,
  formatTransactions,
  formatInterval,
  calculateCV,
  formatExecutionTime,
} from "./formatters";
import { getSuspicionLevel } from "./analyzer";
import { RelationshipNetwork } from "./relationship-analyzer";

export interface ContentGeneratorOptions {
  targetUser: User;
  userInfo: UserInfoData;
  usagePatterns: CommandUsagePattern[];
  recentFrequency: { command_name: string; usage_count: number }[];
  recentTransactions: any[];
  relationshipNetwork?: RelationshipNetwork;
  client: Client;
  interactionSortBy?: "count" | "amount";
  relationshipSubView?: "overview" | "pagerank" | "communities" | "cycles" | "clusters" | "connections" | "guilds";
  expandedCommunities?: Set<number>;
  transactionPage?: number;
}

/**
 * 生成綜合資訊內容
 */
export function createGeneralContent(
  options: ContentGeneratorOptions
): string {
  const { targetUser, userInfo, client } = options;

  const topGuildsContent = formatTopGuilds(userInfo.top_guilds, client);
  const topCommandsContent = formatTopCommands(userInfo.top_commands);

  return (
    `# 👤 ${targetUser.username} 的使用者資訊\n\n` +
    `## 📋 基本資訊\n` +
    `- **使用者標籤**: ${targetUser.tag}\n` +
    `- **使用者 ID**: \`${targetUser.id}\`\n` +
    `- **帳號建立時間**: <t:${Math.floor(targetUser.createdTimestamp / 1000)}:R>\n\n` +
    `## 📊 活動統計\n` +
    `### 最活躍的伺服器\n${topGuildsContent}\n\n` +
    `### 最常用指令 (Top 10)\n${topCommandsContent}`
  );
}

/**
 * 生成財務總覽內容
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
 * 生成互動排行內容
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

/**
 * 生成使用模式分析內容
 */
export function createUsagePatternContent(
  options: ContentGeneratorOptions
): string {
  const { targetUser, usagePatterns, recentFrequency } = options;

  if (usagePatterns.length === 0) {
    return `# 🔍 ${targetUser.username} 的使用模式分析\n\n無足夠資料進行分析。`;
  }

  let content = `# 🔍 ${targetUser.username} 的使用模式分析\n\n`;
  content += `> 此分析用於檢測異常使用模式，協助識別潛在的小帳或機器人行為。\n\n`;

  if (recentFrequency.length > 0) {
    content += `## ⚡ 最近 60 分鐘使用頻率\n`;
    recentFrequency.forEach((freq) => {
      content += `- \`${freq.command_name}\`: ${freq.usage_count} 次\n`;
    });
    content += `\n`;
  }

  content += `## 📊 指令使用模式詳細分析\n\n`;

  usagePatterns.slice(0, 15).forEach((pattern) => {
    const suspicion = getSuspicionLevel(pattern);
    const statusEmoji =
      suspicion.level === "高度可疑"
        ? "🚨"
        : suspicion.level === "可疑"
          ? "⚠️"
          : "✅";

    content += `### ${statusEmoji} \`${pattern.command_name}\` - ${suspicion.level}\n`;
    content += `- **使用次數**: ${pattern.usage_count} 次\n`;
    if (pattern.avg_interval_seconds > 0) {
      content += `- **平均使用間隔**: ${formatInterval(pattern.avg_interval_seconds)} ± ${formatInterval(pattern.interval_stddev_seconds)}\n`;
      const intervalCV = calculateCV(
        pattern.interval_stddev_seconds,
        pattern.avg_interval_seconds
      );
      content += `- **間隔穩定度**: CV = ${intervalCV.toFixed(1)}% ${intervalCV < 10 ? "(極度規律 ⚠️)" : intervalCV < 30 ? "(規律)" : "(正常)"}\n`;
    }
    const timeSpanDays =
      (new Date(pattern.last_used_at).getTime() -
        new Date(pattern.first_used_at).getTime()) /
      (1000 * 60 * 60 * 24);
    if (timeSpanDays > 0) {
      content += `- **使用頻率**: ${(pattern.usage_count / timeSpanDays).toFixed(1)} 次/天\n`;
    }
    content += `- **首次使用**: <t:${Math.floor(new Date(pattern.first_used_at).getTime() / 1000)}:R>\n`;
    content += `- **最後使用**: <t:${Math.floor(new Date(pattern.last_used_at).getTime() / 1000)}:R>\n`;

    if (suspicion.reasons.length > 0) {
      content += `- **可疑原因**:\n`;
      suspicion.reasons.forEach((reason) => {
        content += `  - ${reason}\n`;
      });
    }
    content += `\n`;
  });

  return content;
}

/**
 * 截斷內容以符合 Discord 2000 字元限制
 */
function truncateContent(content: string, maxLength: number = 1900): string {
  if (content.length <= maxLength) return content;
  return content.substring(0, maxLength) + "\n\n... (內容過長，已截斷)";
}

/**
 * 生成關係網路分析內容
 */
export function createRelationshipContent(
  options: ContentGeneratorOptions
): string {
  const { targetUser, relationshipNetwork, relationshipSubView = "overview" } = options;

  if (!relationshipNetwork) {
    return `# 🕸️ ${targetUser.username} 的關係網路分析\n\n正在載入資料...`;
  }

  const { direct_connections, indirect_connections, suspicious_clusters, network_stats } =
    relationshipNetwork;

  let content = `# 🕸️ ${targetUser.username} 的關係網路分析\n\n`;
  
  // 根據子視圖顯示不同內容
  switch (relationshipSubView) {
    case "overview":
      return createRelationshipOverview(targetUser, relationshipNetwork);
    case "pagerank":
      return createPageRankView(targetUser, relationshipNetwork);
    case "communities":
      return createCommunitiesView(targetUser, relationshipNetwork, options.expandedCommunities);
    case "cycles":
      return createCyclesView(targetUser, relationshipNetwork);
    case "clusters":
      return createClustersView(targetUser, relationshipNetwork);
    case "connections":
      return createConnectionsView(targetUser, relationshipNetwork);
    case "guilds":
      return createGuildsView(targetUser, relationshipNetwork);
    default:
      return createRelationshipOverview(targetUser, relationshipNetwork);
  }
}

/**
 * 總覽視圖
 */
function createRelationshipOverview(
  targetUser: User,
  relationshipNetwork: RelationshipNetwork
): string {
  const { network_stats } = relationshipNetwork;
  
  let content = `# 🕸️ ${targetUser.username} 的關係網路分析\n\n`;
  content += `> 分析帳號之間的交易關係，檢測可疑的小帳集團或關聯帳號。\n\n`;

  // 網路統計
  content += `## 📊 網路統計總覽\n`;
  content += `- 🔗 直接關係數: **${network_stats.total_connections}** 個帳號\n`;
  content += `- 🔢 總交易次數: **${network_stats.total_transactions.toLocaleString()}** 次\n`;
  content += `- 💰 總交易金額: **${network_stats.total_amount.toLocaleString()}** 元\n`;
  content += `- 📈 平均關係強度: **${network_stats.avg_relationship_strength.toFixed(1)}** / 100\n\n`;

  // PageRank 關鍵節點
  if (relationshipNetwork.key_nodes && relationshipNetwork.key_nodes.length > 0) {
    content += `## 👑 關鍵節點 (PageRank)\n`;

    relationshipNetwork.key_nodes.slice(0, 3).forEach((node) => {
      const isTarget = node.user_id === targetUser.id;
      const emoji = node.rank === 1 ? "👑" : node.rank === 2 ? "🥈" : "🥉";
      const score = (node.pagerank * 100).toFixed(2);
      
      content += `${emoji} <@${node.user_id}>${isTarget ? " (目標)" : ""} - ${score}%\n`;
    });
    content += `\n`;
  }

  // Louvain 社群檢測
  if (relationshipNetwork.communities && relationshipNetwork.communities.length > 0) {
    content += `## 🏘️ 社群檢測\n`;
    content += `發現 ${relationshipNetwork.communities.length} 個社群\n\n`;

    relationshipNetwork.communities.slice(0, 2).forEach((community, i) => {
      const scoreEmoji = community.suspicion_score >= 70 ? "🚨" : community.suspicion_score >= 50 ? "⚠️" : "✅";
      content += `${scoreEmoji} **社群 ${i + 1}** (${community.suspicion_score}/100)\n`;
      content += `成員 ${community.members.length} 人: `;
      content += community.members.slice(0, 5).map(uid => `<@${uid}>`).join(", ");
      if (community.members.length > 5) {
        content += ` +${community.members.length - 5}`;
      }
      content += `\n模組度: ${(community.modularity * 100).toFixed(0)}%\n\n`;
    });
  }

  // 循環交易檢測
  if (relationshipNetwork.cycle_patterns && relationshipNetwork.cycle_patterns.length > 0) {
    content += `## 🔄 循環交易\n`;
    content += `發現 ${relationshipNetwork.cycle_patterns.length} 個循環\n\n`;

    relationshipNetwork.cycle_patterns.slice(0, 3).forEach((cycle, i) => {
      const scoreEmoji = cycle.suspicion_score >= 80 ? "🚨" : "⚠️";
      content += `${scoreEmoji} **循環 ${i + 1}** (${cycle.suspicion_score}/100)\n`;
      content += `路徑: `;
      cycle.cycle.slice(0, 4).forEach((uid, idx) => {
        content += `<@${uid}>`;
        if (idx < Math.min(cycle.cycle.length, 4) - 1) content += ` → `;
      });
      if (cycle.cycle.length > 4) content += ` ...`;
      content += `\n金額: ${cycle.total_amount.toLocaleString()} 元\n\n`;
    });
  }

  // 可疑集群（基於規則）
  if (relationshipNetwork.suspicious_clusters && relationshipNetwork.suspicious_clusters.length > 0) {
    content += `## 🚨 規則式集群\n`;
    content += `發現 ${relationshipNetwork.suspicious_clusters.length} 個可疑集群\n\n`;

    relationshipNetwork.suspicious_clusters.slice(0, 2).forEach((cluster, i) => {
      const scoreEmoji = cluster.suspicion_score >= 85 ? "🚨" : "⚠️";
      content += `${scoreEmoji} **集群 ${i + 1}** (${cluster.suspicion_score}/100)\n`;
      content += `涉及 ${cluster.user_ids.length} 人: `;
      content += cluster.user_ids.slice(0, 5).map((uid: string) => `<@${uid}>`).join(", ");
      if (cluster.user_ids.length > 5) {
        content += ` +${cluster.user_ids.length - 5}`;
      }
      content += `\n`;
      if (cluster.reasons.length > 0) {
        content += `原因: ${cluster.reasons[0]}\n`;
      }
      content += `\n`;
    });
  }

  // 直接關係 Top 5
  content += `## 🔗 直接關係 Top 5\n`;
  if (relationshipNetwork.direct_connections && relationshipNetwork.direct_connections.length > 0) {
    relationshipNetwork.direct_connections.slice(0, 5).forEach((conn, i) => {
      const strengthEmoji = conn.relationship_strength >= 70 ? "🔴" : conn.relationship_strength >= 40 ? "🟡" : "🟢";
      
      content += `${i + 1}. <@${conn.related_user_id}> ${strengthEmoji} ${conn.relationship_strength}\n`;
      content += `   ${conn.transaction_count} 次 | ${conn.total_amount.toLocaleString()} 元\n`;
    });
    content += `\n`;
  } else {
    content += `無直接關係。\n\n`;
  }

  // 間接關係
  if (relationshipNetwork.indirect_connections && relationshipNetwork.indirect_connections.length > 0) {
    content += `## 🔗🔗 間接關係 Top 3\n`;
    relationshipNetwork.indirect_connections.slice(0, 3).forEach((conn, i) => {
      content += `${i + 1}. <@${conn.related_user_id}> - ${conn.transaction_count} 次\n`;
    });
  }

  return content;
}

/**
 * 生成詳細記錄內容
 */
export function createDetailsContent(options: ContentGeneratorOptions): string {
  const { targetUser, userInfo, recentTransactions, transactionPage = 0 } = options;

  // 分頁處理
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
 * PageRank 關鍵節點視圖
 */
function createPageRankView(
  targetUser: User,
  relationshipNetwork: RelationshipNetwork
): string {
  let content = `# 👑 關鍵節點分析 (PageRank)\n\n`;
  content += `> PageRank 算法識別網路中最重要的節點，分數越高表示該帳號在交易網路中的影響力越大。\n\n`;

  if (relationshipNetwork.key_nodes && relationshipNetwork.key_nodes.length > 0) {
    content += `## 📊 Top 10 關鍵節點\n\n`;
    
    relationshipNetwork.key_nodes.forEach((node) => {
      const isTarget = node.user_id === targetUser.id;
      const emoji = node.rank === 1 ? "👑" : node.rank === 2 ? "🥈" : node.rank === 3 ? "🥉" : "📍";
      const score = (node.pagerank * 100).toFixed(2);
      const bar = "█".repeat(Math.floor(node.pagerank * 50));
      
      content += `${emoji} **#${node.rank}** <@${node.user_id}>${isTarget ? " (目標)" : ""}\n`;
      content += `   分數: ${score}% ${bar}\n\n`;
    });
  } else {
    content += `無足夠資料進行 PageRank 分析。\n`;
  }

  return content;
}

/**
 * 社群檢測視圖
 */
function createCommunitiesView(
  targetUser: User,
  relationshipNetwork: RelationshipNetwork,
  expandedCommunities?: Set<number>
): string {
  let content = `# 🏘️ 社群檢測分析\n\n`;
  content += `> 使用 Louvain 算法自動發現緊密交易的群組，可能代表朋友圈、工作室或小帳集團。\n`;
  content += `> 💡 提示：點擊「展開」按鈕查看完整成員列表\n\n`;

  if (relationshipNetwork.communities && relationshipNetwork.communities.length > 0) {
    content += `## 📊 發現 ${relationshipNetwork.communities.length} 個社群\n\n`;

    relationshipNetwork.communities.forEach((community, i) => {
      const scoreEmoji = community.suspicion_score >= 70 ? "🚨" : community.suspicion_score >= 50 ? "⚠️" : "✅";
      const isExpanded = expandedCommunities?.has(i) || false;
      
      content += `${scoreEmoji} **社群 ${i + 1}** - 可疑度: ${community.suspicion_score}/100\n`;
      content += `- 成員數: ${community.members.length} 人\n`;
      content += `- 模組度: ${(community.modularity * 100).toFixed(1)}%\n`;
      content += `- 成員: `;
      
      if (isExpanded || community.members.length <= 10) {
        // 顯示所有成員
        content += community.members.map((uid: string) => `<@${uid}>`).join(", ");
      } else {
        // 只顯示前 10 個
        content += community.members.slice(0, 10).map((uid: string) => `<@${uid}>`).join(", ");
        content += ` +${community.members.length - 10} 人`;
      }
      
      // 添加展開/收起提示（實際按鈕在 action buttons 中）
      if (community.members.length > 10) {
        content += `\n  ${isExpanded ? "▲" : "▼"} 使用「展開社群 ${i + 1}」按鈕${isExpanded ? "收起" : "查看全部"}`;
      }
      
      content += `\n\n`;
    });
  } else {
    content += `無足夠資料進行社群檢測。\n`;
  }

  return content;
}

/**
 * 循環交易視圖
 */
function createCyclesView(
  targetUser: User,
  relationshipNetwork: RelationshipNetwork
): string {
  let content = `# 🔄 循環交易檢測\n\n`;
  content += `> 檢測資金在多個帳號間循環流動的模式，這可能是洗錢或小帳互刷的跡象。\n\n`;

  if (relationshipNetwork.cycle_patterns && relationshipNetwork.cycle_patterns.length > 0) {
    content += `## 🚨 發現 ${relationshipNetwork.cycle_patterns.length} 個循環\n\n`;

    relationshipNetwork.cycle_patterns.forEach((cycle, i) => {
      const scoreEmoji = cycle.suspicion_score >= 80 ? "🚨" : cycle.suspicion_score >= 60 ? "⚠️" : "⚡";
      content += `${scoreEmoji} **循環 ${i + 1}** - 可疑度: ${cycle.suspicion_score}/100\n`;
      content += `- 循環長度: ${cycle.cycle.length} 個帳號\n`;
      content += `- 總金額: ${cycle.total_amount.toLocaleString()} 元\n`;
      content += `- 路徑: `;
      
      cycle.cycle.forEach((uid, idx) => {
        content += `<@${uid}>`;
        if (idx < cycle.cycle.length - 1) content += ` → `;
      });
      content += ` → <@${cycle.cycle[0]}>\n\n`;
    });
  } else {
    content += `未發現明顯的循環交易模式。\n`;
  }

  return content;
}

/**
 * 可疑集群視圖
 */
function createClustersView(
  targetUser: User,
  relationshipNetwork: RelationshipNetwork
): string {
  let content = `# 🚨 可疑集群檢測\n\n`;
  content += `> 使用精確指標檢測可疑行為：資金循環、單向大額轉出、短期高頻等。\n\n`;

  if (relationshipNetwork.suspicious_clusters && relationshipNetwork.suspicious_clusters.length > 0) {
    content += `## 🔍 發現 ${relationshipNetwork.suspicious_clusters.length} 個可疑集群\n\n`;

    relationshipNetwork.suspicious_clusters.forEach((cluster, i) => {
      const scoreEmoji = cluster.suspicion_score >= 85 ? "🚨" : cluster.suspicion_score >= 70 ? "⚠️" : "⚡";
      
      // 根據 cluster_id 判斷類型
      let clusterType = "未知類型";
      if (cluster.cluster_id.includes("circular_flow")) {
        clusterType = "💫 資金循環集群";
      } else if (cluster.cluster_id.includes("large_outflow")) {
        clusterType = "📤 大額單向轉出";
      } else if (cluster.cluster_id.includes("short_term_high_freq")) {
        clusterType = "⚡ 短期高頻互動";
      }
      
      content += `${scoreEmoji} **${clusterType}** - 可疑度: ${cluster.suspicion_score}/100\n`;
      content += `- 涉及帳號: ${cluster.user_ids.length} 個\n`;
      content += `- 交易統計:\n`;
      content += `  • 總交易次數: ${cluster.transaction_pattern.total_transactions} 次\n`;
      content += `  • 總交易金額: ${cluster.transaction_pattern.total_amount.toLocaleString()} 元\n`;
      content += `- 可疑特徵:\n`;
      cluster.reasons.forEach(reason => {
        content += `  • ${reason}\n`;
      });
      content += `- 涉及成員: `;
      content += cluster.user_ids.slice(0, 10).map(uid => `<@${uid}>`).join(", ");
      if (cluster.user_ids.length > 10) {
        content += ` +${cluster.user_ids.length - 10} 人`;
      }
      content += `\n\n`;
    });
  } else {
    content += `✅ 未發現明顯的可疑集群。\n`;
  }

  return content;
}

/**
 * 直接/間接關係視圖
 */
function createConnectionsView(
  targetUser: User,
  relationshipNetwork: RelationshipNetwork
): string {
  const { direct_connections, indirect_connections } = relationshipNetwork;
  
  let content = `# 🔗 關係連接詳情\n\n`;
  content += `> 查看與目標帳號的直接和間接交易關係。\n\n`;

  // 直接關係
  content += `## 🔗 直接關係 (${direct_connections.length})\n\n`;
  if (direct_connections.length > 0) {
    direct_connections.slice(0, 20).forEach((conn, i) => {
      const strengthEmoji = conn.relationship_strength >= 70 ? "🔴" : conn.relationship_strength >= 40 ? "🟡" : "🟢";
      
      content += `${i + 1}. <@${conn.related_user_id}> ${strengthEmoji} 強度: ${conn.relationship_strength}\n`;
      content += `   • 交易次數: ${conn.transaction_count} 次\n`;
      content += `   • 總金額: ${conn.total_amount.toLocaleString()} 元\n`;
      content += `   • 平均金額: ${conn.avg_amount.toLocaleString()} 元\n`;
      content += `   • 首次交易: <t:${Math.floor(new Date(conn.first_transaction).getTime() / 1000)}:R>\n`;
      content += `   • 最後交易: <t:${Math.floor(new Date(conn.last_transaction).getTime() / 1000)}:R>\n\n`;
    });
    
    if (direct_connections.length > 20) {
      content += `... 還有 ${direct_connections.length - 20} 個直接關係\n\n`;
    }
  } else {
    content += `無直接關係。\n\n`;
  }

  // 間接關係
  content += `## 🔗🔗 間接關係 (${indirect_connections.length})\n\n`;
  if (indirect_connections.length > 0) {
    indirect_connections.slice(0, 15).forEach((conn, i) => {
      content += `${i + 1}. <@${conn.related_user_id}>\n`;
      content += `   • 交易次數: ${conn.transaction_count} 次\n`;
      content += `   • 總金額: ${conn.total_amount.toLocaleString()} 元\n\n`;
    });
    
    if (indirect_connections.length > 15) {
      content += `... 還有 ${indirect_connections.length - 15} 個間接關係\n`;
    }
  } else {
    content += `無間接關係。\n`;
  }

  return content;
}

/**
 * 伺服器關聯分析視圖
 */
function createGuildsView(
  targetUser: User,
  relationshipNetwork: RelationshipNetwork
): string {
  let content = `# 🏰 伺服器關聯分析\n\n`;
  content += `> 分析用戶所在伺服器的成員行為，檢測集體異常模式。\n\n`;

  if (relationshipNetwork.guild_correlations && relationshipNetwork.guild_correlations.length > 0) {
    content += `## 📊 分析 ${relationshipNetwork.guild_correlations.length} 個伺服器\n\n`;

    relationshipNetwork.guild_correlations.forEach((guild, i) => {
      const scoreEmoji = guild.suspicion_score >= 70 ? "🚨" : guild.suspicion_score >= 40 ? "⚠️" : "✅";
      
      content += `${scoreEmoji} **伺服器 ${i + 1}** - 可疑度: ${guild.suspicion_score}/100\n`;
      content += `- 伺服器 ID: \`${guild.guild_id}\`\n`;
      content += `- 活躍成員: ${guild.member_count} 人\n`;
      content += `- 可疑成員: ${guild.suspicious_members.length} 人\n\n`;
      
      // 統計數據
      content += `**交易統計:**\n`;
      content += `- 總交易次數: ${guild.statistics.total_transactions} 次\n`;
      content += `- 總交易金額: ${guild.statistics.total_amount.toLocaleString()} 元\n`;
      content += `- 平均每人交易: ${guild.statistics.avg_transactions_per_member.toFixed(1)} 次\n`;
      content += `- 高頻成員: ${guild.statistics.high_frequency_members} 人\n`;
      content += `- 循環交易對: ${guild.statistics.circular_flow_pairs} 對\n\n`;
      
      // 異常模式
      if (guild.patterns.length > 0) {
        content += `**異常模式:**\n`;
        guild.patterns.forEach((pattern: string) => {
          content += `- ${pattern}\n`;
        });
        content += `\n`;
      }
      
      // 可疑成員列表
      if (guild.suspicious_members.length > 0) {
        content += `**可疑成員 Top ${Math.min(5, guild.suspicious_members.length)}:**\n`;
        guild.suspicious_members.slice(0, 5).forEach((member: any, idx: number) => {
          const memberEmoji = member.suspicion_score >= 85 ? "🚨" : "⚠️";
          content += `${idx + 1}. ${memberEmoji} <@${member.user_id}> (${member.suspicion_score}/100)\n`;
          content += `   交易: ${member.transaction_count} 次 | 金額: ${member.total_amount.toLocaleString()} 元\n`;
          if (member.reasons.length > 0) {
            content += `   原因: ${member.reasons[0]}\n`;
          }
        });
        content += `\n`;
      }
      
      content += `---\n\n`;
    });
  } else {
    content += `✅ 未發現伺服器層級的異常行為。\n`;
  }

  return content;
}
