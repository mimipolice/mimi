/**
 * Relationship Content Generators
 * 
 * This module contains all content generation functions related to relationship
 * network analysis, including PageRank, community detection, cycle patterns,
 * suspicious clusters, and guild correlation analysis.
 * 
 * Requirements: 1.1, 1.3, 1.4, 2.1, 2.2, 4.2, 4.5, 5.2, 5.3
 */

import { User } from "discord.js";
import { RelationshipNetwork } from "../relationship-analyzer";
import { ContentGeneratorOptions } from "./types";

/**
 * Main relationship content router
 * 
 * Routes to the appropriate relationship sub-view based on the relationshipSubView option.
 * 
 * @param options - Content generator options including relationship network data
 * @returns Formatted content string for the selected relationship view
 */
export function createRelationshipContent(
  options: ContentGeneratorOptions
): string {
  const { targetUser, relationshipNetwork, relationshipSubView = "overview" } = options;

  if (!relationshipNetwork) {
    return `# 🕸️ ${targetUser.username} 的關係網路分析\n\n正在載入資料...`;
  }

  // Route to appropriate sub-view
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
 * Create relationship overview content
 * 
 * Displays a comprehensive overview of the relationship network including
 * network statistics, key nodes, communities, cycles, and suspicious clusters.
 * 
 * @param targetUser - The Discord user being analyzed
 * @param relationshipNetwork - The relationship network data
 * @returns Formatted overview content string
 */
function createRelationshipOverview(
  targetUser: User,
  relationshipNetwork: RelationshipNetwork
): string {
  const { network_stats } = relationshipNetwork;
  
  let content = `# 🕸️ ${targetUser.username} 的關係網路分析\n\n`;
  content += `> 分析帳號之間的交易關係，檢測可疑的小帳集團或關聯帳號。\n\n`;

  // Network statistics
  content += `## 📊 網路統計總覽\n`;
  content += `- 🔗 直接關係數: **${network_stats.total_connections}** 個帳號\n`;
  content += `- 🔢 總交易次數: **${network_stats.total_transactions.toLocaleString()}** 次\n`;
  content += `- 💰 總交易金額: **${network_stats.total_amount.toLocaleString()}** 元\n`;
  content += `- 📈 平均關係強度: **${network_stats.avg_relationship_strength.toFixed(1)}** / 100\n\n`;

  // PageRank key nodes
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

  // Louvain community detection
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

  // Cycle detection
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

  // Suspicious clusters (rule-based)
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

  // Direct relationships Top 5
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

  // Indirect relationships
  if (relationshipNetwork.indirect_connections && relationshipNetwork.indirect_connections.length > 0) {
    content += `## 🔗🔗 間接關係 Top 3\n`;
    relationshipNetwork.indirect_connections.slice(0, 3).forEach((conn, i) => {
      content += `${i + 1}. <@${conn.related_user_id}> - ${conn.transaction_count} 次\n`;
    });
  }

  return content;
}

/**
 * Create PageRank key nodes view
 * 
 * Displays the top 10 most influential nodes in the network based on PageRank algorithm.
 * 
 * @param targetUser - The Discord user being analyzed
 * @param relationshipNetwork - The relationship network data
 * @returns Formatted PageRank view content string
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
 * Create communities view
 * 
 * Displays community detection results using Louvain algorithm, showing
 * tightly-knit groups that may represent friend circles or suspicious clusters.
 * 
 * @param targetUser - The Discord user being analyzed
 * @param relationshipNetwork - The relationship network data
 * @param expandedCommunities - Set of community indices that should be fully expanded
 * @returns Formatted communities view content string
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
        // Show all members
        content += community.members.map((uid: string) => `<@${uid}>`).join(", ");
      } else {
        // Show only first 10
        content += community.members.slice(0, 10).map((uid: string) => `<@${uid}>`).join(", ");
        content += ` +${community.members.length - 10} 人`;
      }
      
      // Add expand/collapse hint (actual button is in action buttons)
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
 * Create cycles view
 * 
 * Displays detected circular transaction patterns that may indicate
 * money laundering or account farming behavior.
 * 
 * @param targetUser - The Discord user being analyzed
 * @param relationshipNetwork - The relationship network data
 * @returns Formatted cycles view content string
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
 * Create suspicious clusters view
 * 
 * Displays rule-based suspicious cluster detection results, identifying
 * groups with specific suspicious patterns like circular flows or high-frequency trading.
 * 
 * @param targetUser - The Discord user being analyzed
 * @param relationshipNetwork - The relationship network data
 * @returns Formatted clusters view content string
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
      
      // Determine cluster type based on cluster_id
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
 * Create connections view
 * 
 * Displays detailed direct and indirect connection information, including
 * net flow analysis and suspicious income/outflow patterns.
 * 
 * @param targetUser - The Discord user being analyzed
 * @param relationshipNetwork - The relationship network data
 * @returns Formatted connections view content string
 */
function createConnectionsView(
  targetUser: User,
  relationshipNetwork: RelationshipNetwork
): string {
  const { direct_connections, indirect_connections } = relationshipNetwork;
  
  let content = `# 🔗 關係連接詳情\n\n`;
  content += `> 查看與目標帳號的直接交易關係，包含詳細的淨流量分析。\n\n`;

  // Sort by net income (income - expense)
  const sortedByNetIncome = [...direct_connections]
    .filter(conn => conn.sent_amount !== undefined && conn.received_amount !== undefined)
    .sort((a, b) => {
      const netA = (a.received_amount || 0) - (a.sent_amount || 0);
      const netB = (b.received_amount || 0) - (b.sent_amount || 0);
      return netB - netA;
    });

  // Suspicious income accounts (net income > 100,000)
  const suspiciousIncome = sortedByNetIncome.filter(conn => {
    const netIncome = (conn.received_amount || 0) - (conn.sent_amount || 0);
    return netIncome > 100000;
  });

  if (suspiciousIncome.length > 0) {
    content += `## 📥 可疑收款帳號 (淨收入 > 10萬)\n`;
    content += `> 按淨收入排序\n\n`;
    
    suspiciousIncome.slice(0, 10).forEach((conn, i) => {
      const netIncome = (conn.received_amount || 0) - (conn.sent_amount || 0);
      const incomeEmoji = netIncome > 1000000 ? "🚨" : netIncome > 500000 ? "⚠️" : "💰";
      
      content += `**${i + 1}. ${incomeEmoji} <@${conn.related_user_id}>**\n`;
      content += `💰 **淨收入: +${netIncome.toLocaleString()} 油幣**\n`;
      content += `📥 收款: ${(conn.received_amount || 0).toLocaleString()} (${conn.received_count || 0} 筆) | `;
      content += `📤 付款: ${(conn.sent_amount || 0).toLocaleString()} (${conn.sent_count || 0} 筆)\n`;
      
      // Show income source details
      if (conn.income_sources && conn.income_sources.length > 0) {
        content += `來源 (前10):\n`;
        conn.income_sources.slice(0, 10).forEach(source => {
          content += `  • <@${source.from_user_id}> (${source.amount.toLocaleString()}/${source.count}筆)\n`;
        });
        if (conn.income_sources.length > 10) {
          content += `  ... 還有 ${conn.income_sources.length - 10} 個來源\n`;
        }
      }
      
      content += `\n`;
    });
  }

  // Suspicious outflow accounts (net expense > 100,000)
  const suspiciousOutflow = sortedByNetIncome.filter(conn => {
    const netIncome = (conn.received_amount || 0) - (conn.sent_amount || 0);
    return netIncome < -100000;
  }).reverse();

  if (suspiciousOutflow.length > 0) {
    content += `## 📤 可疑付款帳號 (淨支出 > 10萬)\n\n`;
    suspiciousOutflow.slice(0, 10).forEach((conn, i) => {
      const netOutflow = (conn.sent_amount || 0) - (conn.received_amount || 0);
      const outflowEmoji = netOutflow > 1000000 ? "🚨" : netOutflow > 500000 ? "⚠️" : "💸";
      
      content += `${i + 1}. ${outflowEmoji} <@${conn.related_user_id}>\n`;
      content += `   💸 **淨支出: -${netOutflow.toLocaleString()} 元**\n`;
      content += `   📤 付款: ${(conn.sent_amount || 0).toLocaleString()} (${conn.sent_count || 0} 筆)\n`;
      content += `   📥 收款: ${(conn.received_amount || 0).toLocaleString()} (${conn.received_count || 0} 筆)\n`;
      content += `   📊 交易次數: ${conn.transaction_count} 次\n\n`;
    });
  }

  // All direct relationships (sorted by transaction count)
  content += `## 🔗 所有直接關係 (${direct_connections.length})\n`;
  content += `> 按交易次數排序\n\n`;
  
  if (direct_connections.length > 0) {
    const sortedByCount = [...direct_connections].sort((a, b) => b.transaction_count - a.transaction_count);
    
    sortedByCount.slice(0, 15).forEach((conn, i) => {
      const netFlow = (conn.received_amount || 0) - (conn.sent_amount || 0);
      const flowEmoji = netFlow > 0 ? "📥" : netFlow < 0 ? "📤" : "↔️";
      const strengthEmoji = conn.relationship_strength >= 70 ? "🔴" : conn.relationship_strength >= 40 ? "🟡" : "🟢";
      
      content += `${i + 1}. <@${conn.related_user_id}> ${strengthEmoji}\n`;
      content += `   ${flowEmoji} 淨流量: ${netFlow >= 0 ? "+" : ""}${netFlow.toLocaleString()} 元\n`;
      content += `   📊 交易: ${conn.transaction_count} 次 | 總額: ${conn.total_amount.toLocaleString()} 元\n\n`;
    });
    
    if (direct_connections.length > 15) {
      content += `... 還有 ${direct_connections.length - 15} 個直接關係\n\n`;
    }
  } else {
    content += `無直接關係。\n\n`;
  }

  // Indirect relationships
  if (indirect_connections.length > 0) {
    content += `## 🔗🔗 間接關係 (${indirect_connections.length})\n\n`;
    indirect_connections.slice(0, 10).forEach((conn, i) => {
      content += `${i + 1}. <@${conn.related_user_id}> - ${conn.transaction_count} 次\n`;
    });
    
    if (indirect_connections.length > 10) {
      content += `... 還有 ${indirect_connections.length - 10} 個間接關係\n`;
    }
  }

  return content;
}

/**
 * Create guilds view
 * 
 * Displays guild correlation analysis, showing suspicious patterns
 * at the server level including collective anomalies.
 * 
 * @param targetUser - The Discord user being analyzed
 * @param relationshipNetwork - The relationship network data
 * @returns Formatted guilds view content string
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
      
      // Statistics
      content += `**交易統計:**\n`;
      content += `- 總交易次數: ${guild.statistics.total_transactions} 次\n`;
      content += `- 總交易金額: ${guild.statistics.total_amount.toLocaleString()} 元\n`;
      content += `- 平均每人交易: ${guild.statistics.avg_transactions_per_member.toFixed(1)} 次\n`;
      content += `- 高頻成員: ${guild.statistics.high_frequency_members} 人\n`;
      content += `- 循環交易對: ${guild.statistics.circular_flow_pairs} 對\n\n`;
      
      // Anomaly patterns
      if (guild.patterns.length > 0) {
        content += `**異常模式:**\n`;
        guild.patterns.forEach((pattern: string) => {
          content += `- ${pattern}\n`;
        });
        content += `\n`;
      }
      
      // Suspicious members list
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
