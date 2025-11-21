/**
 * 帳號關係網路分析
 * 用於檢測小帳集團、關聯帳號等
 */

import { gachaDB } from "../../../shared/database";
import { sql } from "kysely";

export interface UserRelationship {
  user_id: string;
  related_user_id: string;
  transaction_count: number;
  total_amount: number;
  avg_amount: number;
  first_transaction: Date;
  last_transaction: Date;
  relationship_strength: number; // 0-100 的關係強度分數
}

export interface RelationshipNetwork {
  target_user_id: string;
  direct_connections: UserRelationship[];
  indirect_connections: UserRelationship[]; // 二度關係
  suspicious_clusters: SuspiciousCluster[];
  communities: import("./graph-algorithms").Community[]; // Louvain 社群檢測
  key_nodes: Array<{ user_id: string; pagerank: number; rank: number }>; // PageRank 關鍵節點
  cycle_patterns: import("./graph-algorithms").CyclePattern[]; // 循環交易
  guild_correlations: import("./guild-correlation-analyzer").GuildCorrelation[]; // 伺服器關聯分析
  network_stats: {
    total_connections: number;
    total_transactions: number;
    total_amount: number;
    avg_relationship_strength: number;
  };
}

export interface SuspiciousCluster {
  cluster_id: string;
  user_ids: string[];
  suspicion_score: number;
  reasons: string[];
  transaction_pattern: {
    total_transactions: number;
    total_amount: number;
    time_span_days: number;
    avg_interval_hours: number;
  };
}

/**
 * 分析使用者的關係網路
 */
export async function analyzeUserRelationships(
  userId: string,
  topGuilds?: Array<{ guild_id: string; usage_count: number }>
): Promise<RelationshipNetwork> {
  // 1. 獲取直接關係（一度關係）
  const directConnections = await getDirectConnections(userId);

  // 2. 獲取間接關係（二度關係）
  const indirectConnections = await getIndirectConnections(
    userId,
    directConnections.map((c) => c.related_user_id)
  );

  // 3. 檢測可疑集群（基於規則）
  const suspiciousClusters = await detectSuspiciousClusters(
    userId,
    directConnections
  );

  // 3.5. 伺服器關聯分析
  const { analyzeGuildCorrelations } = await import("./guild-correlation-analyzer.js");
  const guildCorrelations = topGuilds && topGuilds.length > 0
    ? await analyzeGuildCorrelations(userId, topGuilds)
    : [];

  // 4. 建立圖並執行進階分析
  const { buildGraph, calculatePageRank, detectCommunities, detectCycles } =
    await import("./graph-algorithms.js");

  const allRelationships = [...directConnections, ...indirectConnections];
  const graph = buildGraph(allRelationships);

  // 5. PageRank 分析 - 找出關鍵節點
  const pageRankScores = calculatePageRank(graph);
  const keyNodes: Array<{ user_id: string; pagerank: number; rank: number }> = Array.from(pageRankScores.entries())
    .sort((a: [string, number], b: [string, number]) => b[1] - a[1])
    .slice(0, 10)
    .map(([user_id, pagerank]: [string, number], index: number) => ({
      user_id,
      pagerank,
      rank: index + 1,
    }));

  // 6. Louvain 社群檢測 - 自動發現緊密群組
  const communities = detectCommunities(graph);

  // 7. 循環交易檢測
  const cyclePatterns = detectCycles(graph, allRelationships, 5);

  // 8. 計算網路統計
  const networkStats = calculateNetworkStats(directConnections);

  return {
    target_user_id: userId,
    direct_connections: directConnections,
    indirect_connections: indirectConnections,
    suspicious_clusters: suspiciousClusters,
    communities,
    key_nodes: keyNodes,
    cycle_patterns: cyclePatterns,
    guild_correlations: guildCorrelations,
    network_stats: networkStats,
  };
}

/**
 * 獲取直接關係（與目標使用者有交易的帳號）
 */
async function getDirectConnections(
  userId: string
): Promise<UserRelationship[]> {
  const query = sql<{
    related_user_id: string;
    transaction_count: number;
    total_amount: number;
    avg_amount: number;
    first_transaction: Date;
    last_transaction: Date;
  }>`
    SELECT 
      related_user_id,
      COUNT(*)::int as transaction_count,
      SUM(gross_amount)::int as total_amount,
      ROUND(AVG(gross_amount)::numeric, 2) as avg_amount,
      MIN(created_at) as first_transaction,
      MAX(created_at) as last_transaction
    FROM (
      SELECT 
        CASE 
          WHEN sender_id::text = ${userId} THEN receiver_id::text 
          ELSE sender_id::text 
        END as related_user_id,
        gross_amount,
        created_at
      FROM user_transaction_history
      WHERE sender_id::text = ${userId} OR receiver_id::text = ${userId}
    ) AS t
    GROUP BY related_user_id
    HAVING COUNT(*) > 0
    ORDER BY transaction_count DESC
    LIMIT 50
  `;

  const result = await query.execute(gachaDB);

  return result.rows.map((row: any) => ({
    user_id: userId,
    related_user_id: row.related_user_id,
    transaction_count: row.transaction_count,
    total_amount: row.total_amount,
    avg_amount: row.avg_amount,
    first_transaction: row.first_transaction,
    last_transaction: row.last_transaction,
    relationship_strength: calculateRelationshipStrength(
      row.transaction_count,
      row.total_amount,
      row.first_transaction,
      row.last_transaction
    ),
  }));
}

/**
 * 獲取間接關係（二度關係）
 */
async function getIndirectConnections(
  userId: string,
  directUserIds: string[]
): Promise<UserRelationship[]> {
  if (directUserIds.length === 0) return [];

  const query = sql<{
    related_user_id: string;
    transaction_count: number;
    total_amount: number;
    avg_amount: number;
    first_transaction: Date;
    last_transaction: Date;
  }>`
    SELECT 
      related_user_id,
      COUNT(*)::int as transaction_count,
      SUM(gross_amount)::int as total_amount,
      ROUND(AVG(gross_amount)::numeric, 2) as avg_amount,
      MIN(created_at) as first_transaction,
      MAX(created_at) as last_transaction
    FROM (
      SELECT 
        CASE 
          WHEN sender_id::text = ANY(${directUserIds}::text[]) THEN receiver_id::text 
          ELSE sender_id::text 
        END as related_user_id,
        gross_amount,
        created_at
      FROM user_transaction_history
      WHERE sender_id::text = ANY(${directUserIds}::text[]) 
         OR receiver_id::text = ANY(${directUserIds}::text[])
    ) AS t
    GROUP BY related_user_id
    HAVING COUNT(*) >= 3
    ORDER BY transaction_count DESC
    LIMIT 20
  `;

  const result = await query.execute(gachaDB);

  return result.rows
    .filter((row: any) => row.related_user_id !== userId && !directUserIds.includes(row.related_user_id))
    .map((row: any) => ({
      user_id: userId,
      related_user_id: row.related_user_id,
      transaction_count: row.transaction_count,
      total_amount: row.total_amount,
      avg_amount: row.avg_amount,
      first_transaction: row.first_transaction,
      last_transaction: row.last_transaction,
      relationship_strength: calculateRelationshipStrength(
        row.transaction_count,
        row.total_amount,
        row.first_transaction,
        row.last_transaction
      ),
    }));
}

/**
 * 詳細交易關係（包含雙向數據）
 */
interface DetailedConnection extends UserRelationship {
  sent_amount: number; // 目標用戶轉給對方的總金額
  received_amount: number; // 目標用戶從對方收到的總金額
  sent_count: number; // 轉出次數
  received_count: number; // 轉入次數
}

/**
 * 分析詳細的雙向交易數據
 */
async function analyzeDetailedTransactions(
  userId: string,
  connections: UserRelationship[]
): Promise<DetailedConnection[]> {
  if (connections.length === 0) return [];

  const relatedUserIds = connections.map((c) => c.related_user_id);

  // 查詢雙向交易統計
  const query = sql<{
    related_user_id: string;
    sent_amount: number;
    received_amount: number;
    sent_count: number;
    received_count: number;
  }>`
    SELECT 
      related_user_id,
      COALESCE(SUM(sent_amount), 0)::int as sent_amount,
      COALESCE(SUM(received_amount), 0)::int as received_amount,
      COALESCE(SUM(sent_count), 0)::int as sent_count,
      COALESCE(SUM(received_count), 0)::int as received_count
    FROM (
      SELECT 
        CASE 
          WHEN sender_id::text = ${userId} THEN receiver_id::text 
          ELSE sender_id::text 
        END as related_user_id,
        CASE WHEN sender_id::text = ${userId} THEN gross_amount ELSE 0 END as sent_amount,
        CASE WHEN receiver_id::text = ${userId} THEN gross_amount ELSE 0 END as received_amount,
        CASE WHEN sender_id::text = ${userId} THEN 1 ELSE 0 END as sent_count,
        CASE WHEN receiver_id::text = ${userId} THEN 1 ELSE 0 END as received_count
      FROM user_transaction_history
      WHERE (sender_id::text = ${userId} OR receiver_id::text = ${userId})
        AND (
          (sender_id::text = ${userId} AND receiver_id::text = ANY(${relatedUserIds}::text[]))
          OR
          (receiver_id::text = ${userId} AND sender_id::text = ANY(${relatedUserIds}::text[]))
        )
    ) AS t
    GROUP BY related_user_id
  `;

  const result = await query.execute(gachaDB);

  // 合併基本連接數據和詳細數據
  return connections.map((conn) => {
    const detail = result.rows.find((r: any) => r.related_user_id === conn.related_user_id);
    return {
      ...conn,
      sent_amount: detail?.sent_amount || 0,
      received_amount: detail?.received_amount || 0,
      sent_count: detail?.sent_count || 0,
      received_count: detail?.received_count || 0,
    };
  });
}

/**
 * 檢測可疑集群
 * 使用更精確的指標來識別真正可疑的行為
 */
async function detectSuspiciousClusters(
  userId: string,
  connections: UserRelationship[]
): Promise<SuspiciousCluster[]> {
  const clusters: SuspiciousCluster[] = [];

  // 需要查詢雙向交易數據來計算淨流量
  const detailedConnections = await analyzeDetailedTransactions(userId, connections);

  // 1. 檢測資金循環集群（互相轉帳但淨流量接近 0）
  const circularFlowCluster = detailedConnections.filter((c) => {
    const netFlow = Math.abs(c.sent_amount - c.received_amount);
    const totalFlow = c.sent_amount + c.received_amount;
    const flowRatio = totalFlow > 0 ? netFlow / totalFlow : 0;
    
    // 高頻互動但淨流量很小（< 10%）= 可疑
    return (
      c.transaction_count > 30 &&
      totalFlow > 50000 &&
      flowRatio < 0.1
    );
  });

  if (circularFlowCluster.length >= 2) {
    const reasons: string[] = [];
    const totalTransactions = circularFlowCluster.reduce((sum, c) => sum + c.transaction_count, 0);
    const avgNetFlow = circularFlowCluster.reduce((sum, c) => 
      sum + Math.abs(c.sent_amount - c.received_amount), 0
    ) / circularFlowCluster.length;

    reasons.push(`發現 ${circularFlowCluster.length} 個資金循環帳號`);
    reasons.push(`高頻互動 (${totalTransactions} 次) 但淨流量極低`);
    reasons.push(`平均淨流量: ${avgNetFlow.toLocaleString()} 元 (< 10%)`);

    clusters.push({
      cluster_id: `circular_flow_${userId}`,
      user_ids: [userId, ...circularFlowCluster.map((c) => c.related_user_id)],
      suspicion_score: 90,
      reasons,
      transaction_pattern: {
        total_transactions: totalTransactions,
        total_amount: circularFlowCluster.reduce((sum, c) => sum + c.sent_amount + c.received_amount, 0),
        time_span_days: 0,
        avg_interval_hours: 0,
      },
    });
  }

  // 2. 檢測單向大額轉出集群（可能是詐騙或被盜）
  const largeOutflowCluster = detailedConnections.filter((c) => {
    const netOutflow = c.sent_amount - c.received_amount;
    return (
      netOutflow > 500000 && // 淨轉出 > 50 萬
      c.sent_amount > c.received_amount * 5 && // 轉出是轉入的 5 倍以上
      c.transaction_count > 5
    );
  });

  if (largeOutflowCluster.length >= 1) {
    const reasons: string[] = [];
    const totalOutflow = largeOutflowCluster.reduce((sum, c) => sum + (c.sent_amount - c.received_amount), 0);

    reasons.push(`發現 ${largeOutflowCluster.length} 個大額單向轉出帳號`);
    reasons.push(`淨轉出: ${totalOutflow.toLocaleString()} 元`);
    reasons.push(`轉出遠大於轉入 (比例 > 5:1)`);

    clusters.push({
      cluster_id: `large_outflow_${userId}`,
      user_ids: [userId, ...largeOutflowCluster.map((c) => c.related_user_id)],
      suspicion_score: 85,
      reasons,
      transaction_pattern: {
        total_transactions: largeOutflowCluster.reduce((sum, c) => sum + c.transaction_count, 0),
        total_amount: totalOutflow,
        time_span_days: 0,
        avg_interval_hours: 0,
      },
    });
  }

  // 3. 檢測短時間高頻集群（可能是腳本或機器人）
  const now = new Date();
  const shortTermHighFreqCluster = detailedConnections.filter((c) => {
    const daysSinceFirst = (now.getTime() - new Date(c.first_transaction).getTime()) / (1000 * 60 * 60 * 24);
    const transactionsPerDay = daysSinceFirst > 0 ? c.transaction_count / daysSinceFirst : 0;
    
    return (
      daysSinceFirst < 30 && // 30 天內
      transactionsPerDay > 5 && // 每天 > 5 次
      c.transaction_count > 50 // 總次數 > 50
    );
  });

  if (shortTermHighFreqCluster.length >= 2) {
    const reasons: string[] = [];
    const avgFreq = shortTermHighFreqCluster.reduce((sum, c) => {
      const days = (now.getTime() - new Date(c.first_transaction).getTime()) / (1000 * 60 * 60 * 24);
      return sum + (c.transaction_count / days);
    }, 0) / shortTermHighFreqCluster.length;

    reasons.push(`發現 ${shortTermHighFreqCluster.length} 個短期高頻互動帳號`);
    reasons.push(`平均每天交易 ${avgFreq.toFixed(1)} 次`);
    reasons.push(`可能使用腳本或機器人操作`);

    clusters.push({
      cluster_id: `short_term_high_freq_${userId}`,
      user_ids: [userId, ...shortTermHighFreqCluster.map((c) => c.related_user_id)],
      suspicion_score: 80,
      reasons,
      transaction_pattern: {
        total_transactions: shortTermHighFreqCluster.reduce(
          (sum, c) => sum + c.transaction_count,
          0
        ),
        total_amount: shortTermHighFreqCluster.reduce(
          (sum, c) => sum + c.total_amount,
          0
        ),
        time_span_days: 7,
        avg_interval_hours: 0,
      },
    });
  }

  return clusters;
}

/**
 * 計算關係強度（0-100）
 */
function calculateRelationshipStrength(
  transactionCount: number,
  totalAmount: number,
  firstTransaction: Date,
  lastTransaction: Date
): number {
  let score = 0;

  // 交易次數權重 (40%)
  score += Math.min((transactionCount / 100) * 40, 40);

  // 交易金額權重 (30%)
  score += Math.min((totalAmount / 1000000) * 30, 30);

  // 關係持續時間權重 (30%)
  const daysDiff =
    (new Date(lastTransaction).getTime() -
      new Date(firstTransaction).getTime()) /
    (1000 * 60 * 60 * 24);
  score += Math.min((daysDiff / 365) * 30, 30);

  return Math.round(score);
}

/**
 * 計算網路統計
 */
function calculateNetworkStats(connections: UserRelationship[]): {
  total_connections: number;
  total_transactions: number;
  total_amount: number;
  avg_relationship_strength: number;
} {
  return {
    total_connections: connections.length,
    total_transactions: connections.reduce(
      (sum, c) => sum + c.transaction_count,
      0
    ),
    total_amount: connections.reduce((sum, c) => sum + c.total_amount, 0),
    avg_relationship_strength:
      connections.length > 0
        ? connections.reduce((sum, c) => sum + c.relationship_strength, 0) /
          connections.length
        : 0,
  };
}
