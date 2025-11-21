/**
 * 伺服器關聯分析
 * 通過用戶的伺服器活動反向查找該伺服器的異常行為
 */

import { gachaDB } from "../../../shared/database";
import { sql } from "kysely";

export interface GuildCorrelation {
  guild_id: string;
  guild_name?: string;
  suspicion_score: number;
  member_count: number;
  suspicious_members: SuspiciousMember[];
  patterns: string[];
  statistics: {
    total_transactions: number;
    total_amount: number;
    avg_transactions_per_member: number;
    high_frequency_members: number;
    circular_flow_pairs: number;
  };
}

export interface SuspiciousMember {
  user_id: string;
  suspicion_score: number;
  reasons: string[];
  transaction_count: number;
  total_amount: number;
  net_flow: number;
}

/**
 * 分析用戶所在伺服器的關聯異常
 */
export async function analyzeGuildCorrelations(
  userId: string,
  topGuilds: Array<{ guild_id: string; usage_count: number }>
): Promise<GuildCorrelation[]> {
  const correlations: GuildCorrelation[] = [];

  // 分析用戶最活躍的前 3 個伺服器
  for (const guild of topGuilds.slice(0, 3)) {
    const correlation = await analyzeGuildMembers(guild.guild_id, userId);
    if (correlation) {
      correlations.push(correlation);
    }
  }

  return correlations.sort((a, b) => b.suspicion_score - a.suspicion_score);
}

/**
 * 分析單個伺服器的成員行為
 */
async function analyzeGuildMembers(
  guildId: string,
  targetUserId: string
): Promise<GuildCorrelation | null> {
  // 1. 獲取該伺服器的活躍成員
  const membersQuery = sql<{
    user_id: string;
    usage_count: number;
  }>`
    SELECT 
      user_id::text,
      COUNT(*)::int as usage_count
    FROM command_usage_stats
    WHERE guild_id::text = ${guildId}
      AND used_at > NOW() - INTERVAL '30 days'
    GROUP BY user_id
    HAVING COUNT(*) > 10
    ORDER BY usage_count DESC
    LIMIT 50
  `;

  const membersResult = await membersQuery.execute(gachaDB);
  const members = membersResult.rows;

  if (members.length < 3) {
    return null; // 成員太少，無法分析
  }

  // 2. 分析成員間的交易關係
  const memberIds = members.map((m: any) => m.user_id);
  const transactionsQuery = sql<{
    sender_id: string;
    receiver_id: string;
    transaction_count: number;
    total_amount: number;
    sent_amount: number;
    received_amount: number;
  }>`
    SELECT 
      sender_id::text,
      receiver_id::text,
      COUNT(*)::int as transaction_count,
      SUM(gross_amount)::int as total_amount,
      SUM(CASE WHEN sender_id::text = sender_id::text THEN gross_amount ELSE 0 END)::int as sent_amount,
      SUM(CASE WHEN receiver_id::text = receiver_id::text THEN gross_amount ELSE 0 END)::int as received_amount
    FROM user_transaction_history
    WHERE sender_id::text = ANY(${memberIds}::text[])
      AND receiver_id::text = ANY(${memberIds}::text[])
      AND sender_id != receiver_id
    GROUP BY sender_id, receiver_id
    HAVING COUNT(*) > 5
  `;

  const transactionsResult = await transactionsQuery.execute(gachaDB);
  const transactions = transactionsResult.rows;

  // 3. 檢測異常模式
  const suspiciousMembers: SuspiciousMember[] = [];
  const patterns: string[] = [];
  let circularFlowPairs = 0;
  let highFrequencyMembers = 0;

  // 檢測循環交易對
  const transactionMap = new Map<string, any>();
  transactions.forEach((t: any) => {
    const key = `${t.sender_id}-${t.receiver_id}`;
    transactionMap.set(key, t);
  });

  transactions.forEach((t: any) => {
    const reverseKey = `${t.receiver_id}-${t.sender_id}`;
    const reverse = transactionMap.get(reverseKey);
    
    if (reverse) {
      const netFlow = Math.abs(t.total_amount - reverse.total_amount);
      const totalFlow = t.total_amount + reverse.total_amount;
      const flowRatio = totalFlow > 0 ? netFlow / totalFlow : 0;
      
      // 高頻互轉但淨流量很小
      if (t.transaction_count + reverse.transaction_count > 30 && flowRatio < 0.15) {
        circularFlowPairs++;
        
        // 標記這兩個用戶為可疑
        [t.sender_id, t.receiver_id].forEach((uid: string) => {
          if (!suspiciousMembers.find(m => m.user_id === uid)) {
            suspiciousMembers.push({
              user_id: uid,
              suspicion_score: 85,
              reasons: ["參與資金循環交易", `與 <@${uid === t.sender_id ? t.receiver_id : t.sender_id}> 高頻互轉但淨流量極低`],
              transaction_count: t.transaction_count + reverse.transaction_count,
              total_amount: totalFlow,
              net_flow: netFlow,
            });
          }
        });
      }
    }
  });

  // 檢測高頻交易成員
  const transactionCounts = new Map<string, number>();
  transactions.forEach((t: any) => {
    transactionCounts.set(t.sender_id, (transactionCounts.get(t.sender_id) || 0) + t.transaction_count);
    transactionCounts.set(t.receiver_id, (transactionCounts.get(t.receiver_id) || 0) + t.transaction_count);
  });

  transactionCounts.forEach((count, userId) => {
    if (count > 100) {
      highFrequencyMembers++;
      if (!suspiciousMembers.find(m => m.user_id === userId)) {
        suspiciousMembers.push({
          user_id: userId,
          suspicion_score: 70,
          reasons: ["伺服器內高頻交易", `30 天內交易 ${count} 次`],
          transaction_count: count,
          total_amount: 0,
          net_flow: 0,
        });
      }
    }
  });

  // 4. 計算伺服器可疑度
  let suspicionScore = 0;
  
  if (circularFlowPairs >= 3) {
    suspicionScore += 40;
    patterns.push(`發現 ${circularFlowPairs} 對資金循環交易`);
  } else if (circularFlowPairs >= 1) {
    suspicionScore += 20;
    patterns.push(`發現 ${circularFlowPairs} 對資金循環交易`);
  }

  if (highFrequencyMembers >= 5) {
    suspicionScore += 30;
    patterns.push(`${highFrequencyMembers} 個成員有高頻交易行為`);
  } else if (highFrequencyMembers >= 2) {
    suspicionScore += 15;
    patterns.push(`${highFrequencyMembers} 個成員有高頻交易行為`);
  }

  const suspiciousRatio = suspiciousMembers.length / members.length;
  if (suspiciousRatio > 0.3) {
    suspicionScore += 30;
    patterns.push(`${(suspiciousRatio * 100).toFixed(0)}% 的活躍成員有可疑行為`);
  } else if (suspiciousRatio > 0.1) {
    suspicionScore += 15;
    patterns.push(`${(suspiciousRatio * 100).toFixed(0)}% 的活躍成員有可疑行為`);
  }

  // 5. 統計數據
  const totalTransactions = transactions.reduce((sum: number, t: any) => sum + t.transaction_count, 0);
  const totalAmount = transactions.reduce((sum: number, t: any) => sum + t.total_amount, 0);

  return {
    guild_id: guildId,
    suspicion_score: Math.min(100, suspicionScore),
    member_count: members.length,
    suspicious_members: suspiciousMembers.sort((a, b) => b.suspicion_score - a.suspicion_score).slice(0, 10),
    patterns,
    statistics: {
      total_transactions: totalTransactions,
      total_amount: totalAmount,
      avg_transactions_per_member: totalTransactions / members.length,
      high_frequency_members: highFrequencyMembers,
      circular_flow_pairs: circularFlowPairs,
    },
  };
}
