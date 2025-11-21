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
  userId: string
): Promise<RelationshipNetwork> {
  // 1. 獲取直接關係（一度關係）
  const directConnections = await getDirectConnections(userId);

  // 2. 獲取間接關係（二度關係）
  const indirectConnections = await getIndirectConnections(
    userId,
    directConnections.map((c) => c.related_user_id)
  );

  // 3. 檢測可疑集群
  const suspiciousClusters = await detectSuspiciousClusters(
    userId,
    directConnections
  );

  // 4. 計算網路統計
  const networkStats = calculateNetworkStats(directConnections);

  return {
    target_user_id: userId,
    direct_connections: directConnections,
    indirect_connections: indirectConnections,
    suspicious_clusters: suspiciousClusters,
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
      CASE 
        WHEN sender_id = ${userId} THEN receiver_id::text 
        ELSE sender_id::text 
      END as related_user_id,
      COUNT(*)::int as transaction_count,
      SUM(gross_amount)::int as total_amount,
      ROUND(AVG(gross_amount)::numeric, 2) as avg_amount,
      MIN(created_at) as first_transaction,
      MAX(created_at) as last_transaction
    FROM user_transaction_history
    WHERE sender_id = ${userId} OR receiver_id = ${userId}
    GROUP BY CASE WHEN sender_id = ${userId} THEN receiver_id ELSE sender_id END
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
      CASE 
        WHEN sender_id = ANY(${sql.lit(directUserIds)}::bigint[]) THEN receiver_id::text 
        ELSE sender_id::text 
      END as related_user_id,
      COUNT(*)::int as transaction_count,
      SUM(gross_amount)::int as total_amount,
      ROUND(AVG(gross_amount)::numeric, 2) as avg_amount,
      MIN(created_at) as first_transaction,
      MAX(created_at) as last_transaction
    FROM user_transaction_history
    WHERE sender_id = ANY(${sql.lit(directUserIds)}::bigint[]) 
       OR receiver_id = ANY(${sql.lit(directUserIds)}::bigint[])
    GROUP BY CASE WHEN sender_id = ANY(${sql.lit(directUserIds)}::bigint[]) THEN receiver_id ELSE sender_id END
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
 * 檢測可疑集群
 */
async function detectSuspiciousClusters(
  userId: string,
  connections: UserRelationship[]
): Promise<SuspiciousCluster[]> {
  const clusters: SuspiciousCluster[] = [];

  // 1. 檢測高頻互動集群（可能是小帳互刷）
  const highFrequencyCluster = connections.filter(
    (c) => c.transaction_count > 50 && c.relationship_strength > 70
  );

  if (highFrequencyCluster.length >= 2) {
    const reasons: string[] = [];
    const totalTransactions = highFrequencyCluster.reduce(
      (sum, c) => sum + c.transaction_count,
      0
    );
    const totalAmount = highFrequencyCluster.reduce(
      (sum, c) => sum + c.total_amount,
      0
    );

    reasons.push(`發現 ${highFrequencyCluster.length} 個高頻互動帳號`);
    reasons.push(`總交易次數: ${totalTransactions} 次`);
    reasons.push(`關係強度異常高 (平均 > 70)`);

    clusters.push({
      cluster_id: `high_frequency_${userId}`,
      user_ids: [userId, ...highFrequencyCluster.map((c) => c.related_user_id)],
      suspicion_score: 85,
      reasons,
      transaction_pattern: {
        total_transactions: totalTransactions,
        total_amount: totalAmount,
        time_span_days: 0,
        avg_interval_hours: 0,
      },
    });
  }

  // 2. 檢測金額異常集群（可能是洗錢）
  const highAmountCluster = connections.filter(
    (c) => c.total_amount > 1000000 && c.avg_amount > 10000
  );

  if (highAmountCluster.length >= 1) {
    const reasons: string[] = [];
    const totalAmount = highAmountCluster.reduce(
      (sum, c) => sum + c.total_amount,
      0
    );

    reasons.push(`發現 ${highAmountCluster.length} 個大額交易帳號`);
    reasons.push(`總交易金額: ${totalAmount.toLocaleString()} 元`);
    reasons.push(`平均單筆金額異常高 (> 10,000 元)`);

    clusters.push({
      cluster_id: `high_amount_${userId}`,
      user_ids: [userId, ...highAmountCluster.map((c) => c.related_user_id)],
      suspicion_score: 75,
      reasons,
      transaction_pattern: {
        total_transactions: highAmountCluster.reduce(
          (sum, c) => sum + c.transaction_count,
          0
        ),
        total_amount: totalAmount,
        time_span_days: 0,
        avg_interval_hours: 0,
      },
    });
  }

  // 3. 檢測新帳號集群（可能是新建小帳）
  const now = new Date();
  const recentCluster = connections.filter((c) => {
    const daysSinceFirst =
      (now.getTime() - new Date(c.first_transaction).getTime()) /
      (1000 * 60 * 60 * 24);
    return daysSinceFirst < 7 && c.transaction_count > 20;
  });

  if (recentCluster.length >= 2) {
    const reasons: string[] = [];
    reasons.push(`發現 ${recentCluster.length} 個新建立的高頻互動帳號`);
    reasons.push(`首次交易時間 < 7 天`);
    reasons.push(`交易次數已超過 20 次`);

    clusters.push({
      cluster_id: `new_accounts_${userId}`,
      user_ids: [userId, ...recentCluster.map((c) => c.related_user_id)],
      suspicion_score: 90,
      reasons,
      transaction_pattern: {
        total_transactions: recentCluster.reduce(
          (sum, c) => sum + c.transaction_count,
          0
        ),
        total_amount: recentCluster.reduce(
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
