/**
 * 圖論演算法 - 用於社群網路分析
 */

import { UserRelationship } from "./relationship-analyzer";

export interface GraphNode {
  id: string;
  connections: Map<string, number>; // user_id -> weight (transaction_count or amount)
  pageRank?: number;
  community?: number;
}

export interface Graph {
  nodes: Map<string, GraphNode>;
  edges: Array<{ from: string; to: string; weight: number }>;
}

export interface Community {
  id: number;
  members: string[];
  internal_edges: number;
  external_edges: number;
  modularity: number;
  suspicion_score: number;
  reasons: string[];
}

export interface CyclePattern {
  cycle: string[];
  total_amount: number;
  avg_amount: number;
  suspicion_score: number;
  reasons: string[];
}

/**
 * 從關係列表建立圖
 */
export function buildGraph(relationships: UserRelationship[]): Graph {
  const nodes = new Map<string, GraphNode>();
  const edges: Array<{ from: string; to: string; weight: number }> = [];

  relationships.forEach((rel) => {
    // 確保兩個節點都存在
    if (!nodes.has(rel.user_id)) {
      nodes.set(rel.user_id, {
        id: rel.user_id,
        connections: new Map(),
      });
    }
    if (!nodes.has(rel.related_user_id)) {
      nodes.set(rel.related_user_id, {
        id: rel.related_user_id,
        connections: new Map(),
      });
    }

    // 建立雙向連接
    const node1 = nodes.get(rel.user_id)!;
    const node2 = nodes.get(rel.related_user_id)!;

    node1.connections.set(rel.related_user_id, rel.transaction_count);
    node2.connections.set(rel.user_id, rel.transaction_count);

    edges.push({
      from: rel.user_id,
      to: rel.related_user_id,
      weight: rel.transaction_count,
    });
  });

  return { nodes, edges };
}

/**
 * PageRank 演算法 - 找出網路中的關鍵節點
 * 高 PageRank 的節點可能是主帳號或中心節點
 */
export function calculatePageRank(
  graph: Graph,
  iterations: number = 20,
  dampingFactor: number = 0.85
): Map<string, number> {
  const nodes = Array.from(graph.nodes.keys());
  const n = nodes.length;

  if (n === 0) return new Map();

  // 初始化 PageRank
  const pageRank = new Map<string, number>();
  nodes.forEach((node) => pageRank.set(node, 1 / n));

  // 迭代計算
  for (let iter = 0; iter < iterations; iter++) {
    const newPageRank = new Map<string, number>();

    nodes.forEach((node) => {
      let sum = 0;
      const graphNode = graph.nodes.get(node)!;

      // 計算來自其他節點的貢獻
      graph.nodes.forEach((sourceNode, sourceId) => {
        if (sourceNode.connections.has(node)) {
          const outDegree = sourceNode.connections.size;
          sum += pageRank.get(sourceId)! / outDegree;
        }
      });

      newPageRank.set(node, (1 - dampingFactor) / n + dampingFactor * sum);
    });

    // 更新 PageRank
    newPageRank.forEach((value, key) => pageRank.set(key, value));
  }

  // 正規化
  const sum = Array.from(pageRank.values()).reduce((a, b) => a + b, 0);
  pageRank.forEach((value, key) => pageRank.set(key, value / sum));

  return pageRank;
}

/**
 * Louvain 社群檢測演算法（簡化版）
 * 自動發現緊密連結的帳號群組
 */
export function detectCommunities(graph: Graph): Community[] {
  const nodes = Array.from(graph.nodes.keys());
  const communities = new Map<string, number>();

  // 初始化：每個節點自成一個社群
  nodes.forEach((node, index) => communities.set(node, index));

  // 計算模組度增益並合併社群
  let improved = true;
  let iteration = 0;
  const maxIterations = 10;

  while (improved && iteration < maxIterations) {
    improved = false;
    iteration++;

    for (const node of nodes) {
      const currentCommunity = communities.get(node)!;
      let bestCommunity = currentCommunity;
      let bestGain = 0;

      // 檢查移動到鄰居社群的增益
      const graphNode = graph.nodes.get(node)!;
      const neighborCommunities = new Set<number>();

      graphNode.connections.forEach((_, neighbor) => {
        neighborCommunities.add(communities.get(neighbor)!);
      });

      neighborCommunities.forEach((community) => {
        if (community === currentCommunity) return;

        const gain = calculateModularityGain(
          graph,
          node,
          currentCommunity,
          community,
          communities
        );

        if (gain > bestGain) {
          bestGain = gain;
          bestCommunity = community;
        }
      });

      if (bestCommunity !== currentCommunity) {
        communities.set(node, bestCommunity);
        improved = true;
      }
    }
  }

  // 整理社群結果
  const communityMap = new Map<number, string[]>();
  communities.forEach((community, node) => {
    if (!communityMap.has(community)) {
      communityMap.set(community, []);
    }
    communityMap.get(community)!.push(node);
  });

  // 計算每個社群的統計資料
  const result: Community[] = [];
  communityMap.forEach((members, id) => {
    if (members.length < 2) return; // 忽略單節點社群

    const stats = calculateCommunityStats(graph, members);
    const suspicion = analyzeCommunity(graph, members, stats);

    result.push({
      id,
      members,
      internal_edges: stats.internal_edges,
      external_edges: stats.external_edges,
      modularity: stats.modularity,
      suspicion_score: suspicion.score,
      reasons: suspicion.reasons,
    });
  });

  return result.sort((a, b) => b.suspicion_score - a.suspicion_score);
}

/**
 * 計算模組度增益
 */
function calculateModularityGain(
  graph: Graph,
  node: string,
  fromCommunity: number,
  toCommunity: number,
  communities: Map<string, number>
): number {
  const graphNode = graph.nodes.get(node)!;
  let internalEdges = 0;
  let externalEdges = 0;

  graphNode.connections.forEach((weight, neighbor) => {
    if (communities.get(neighbor) === toCommunity) {
      internalEdges += weight;
    } else {
      externalEdges += weight;
    }
  });

  return internalEdges - externalEdges;
}

/**
 * 計算社群統計資料
 */
function calculateCommunityStats(
  graph: Graph,
  members: string[]
): {
  internal_edges: number;
  external_edges: number;
  modularity: number;
} {
  let internal_edges = 0;
  let external_edges = 0;

  members.forEach((member) => {
    const node = graph.nodes.get(member);
    if (!node) return;

    node.connections.forEach((weight, neighbor) => {
      if (members.includes(neighbor)) {
        internal_edges += weight;
      } else {
        external_edges += weight;
      }
    });
  });

  // 避免重複計算（雙向邊）
  internal_edges = internal_edges / 2;

  const totalEdges = internal_edges + external_edges;
  const modularity = totalEdges > 0 ? internal_edges / totalEdges : 0;

  return { internal_edges, external_edges, modularity };
}

/**
 * 分析社群的可疑程度
 */
function analyzeCommunity(
  graph: Graph,
  members: string[],
  stats: { internal_edges: number; external_edges: number; modularity: number }
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  // 1. 高模組度（內部連接緊密）
  if (stats.modularity > 0.8 && members.length >= 3) {
    score += 30;
    reasons.push(
      `社群內部連接極度緊密 (模組度: ${(stats.modularity * 100).toFixed(1)}%)`
    );
  }

  // 2. 社群大小適中（3-10 個帳號最可疑）
  if (members.length >= 3 && members.length <= 10) {
    score += 20;
    reasons.push(`社群大小適中 (${members.length} 個帳號)`);
  }

  // 3. 內部交易頻繁
  const avgInternalEdges = stats.internal_edges / members.length;
  if (avgInternalEdges > 20) {
    score += 25;
    reasons.push(
      `內部交易頻繁 (平均 ${avgInternalEdges.toFixed(1)} 次/人)`
    );
  }

  // 4. 外部連接少（封閉群組）
  const externalRatio = stats.external_edges / (stats.internal_edges + stats.external_edges);
  if (externalRatio < 0.2) {
    score += 25;
    reasons.push(
      `與外部交易少 (僅 ${(externalRatio * 100).toFixed(1)}%)`
    );
  }

  return { score, reasons };
}

/**
 * 檢測循環交易模式（A→B→C→A）
 * 這種模式常見於洗錢或刷交易量
 */
export function detectCycles(
  graph: Graph,
  relationships: UserRelationship[],
  maxCycleLength: number = 5
): CyclePattern[] {
  const cycles: CyclePattern[] = [];
  const visited = new Set<string>();

  // 為每個節點尋找循環
  graph.nodes.forEach((_, startNode) => {
    const path: string[] = [startNode];
    const pathSet = new Set<string>([startNode]);

    findCyclesDFS(
      graph,
      relationships,
      startNode,
      startNode,
      path,
      pathSet,
      cycles,
      maxCycleLength
    );
  });

  // 去重並排序
  const uniqueCycles = deduplicateCycles(cycles);
  return uniqueCycles
    .sort((a, b) => b.suspicion_score - a.suspicion_score)
    .slice(0, 10);
}

/**
 * DFS 尋找循環
 */
function findCyclesDFS(
  graph: Graph,
  relationships: UserRelationship[],
  current: string,
  start: string,
  path: string[],
  pathSet: Set<string>,
  cycles: CyclePattern[],
  maxLength: number
) {
  if (path.length > maxLength) return;

  const node = graph.nodes.get(current);
  if (!node) return;

  node.connections.forEach((_, neighbor) => {
    if (neighbor === start && path.length >= 3) {
      // 找到循環
      const cycle = [...path];
      const stats = analyzeCycle(cycle, relationships);
      cycles.push({
        cycle,
        total_amount: stats.total_amount,
        avg_amount: stats.avg_amount,
        suspicion_score: stats.suspicion_score,
        reasons: stats.reasons,
      });
    } else if (!pathSet.has(neighbor)) {
      path.push(neighbor);
      pathSet.add(neighbor);
      findCyclesDFS(
        graph,
        relationships,
        neighbor,
        start,
        path,
        pathSet,
        cycles,
        maxLength
      );
      path.pop();
      pathSet.delete(neighbor);
    }
  });
}

/**
 * 分析循環的可疑程度
 */
function analyzeCycle(
  cycle: string[],
  relationships: UserRelationship[]
): {
  total_amount: number;
  avg_amount: number;
  suspicion_score: number;
  reasons: string[];
} {
  let total_amount = 0;
  let total_count = 0;
  const reasons: string[] = [];
  let score = 0;

  // 計算循環中的總交易量
  for (let i = 0; i < cycle.length; i++) {
    const from = cycle[i];
    const to = cycle[(i + 1) % cycle.length];

    const rel = relationships.find(
      (r) =>
        (r.user_id === from && r.related_user_id === to) ||
        (r.user_id === to && r.related_user_id === from)
    );

    if (rel) {
      total_amount += rel.total_amount;
      total_count += rel.transaction_count;
    }
  }

  const avg_amount = total_count > 0 ? total_amount / total_count : 0;

  // 評分
  if (cycle.length === 3) {
    score += 40;
    reasons.push("三角循環交易");
  } else if (cycle.length === 4) {
    score += 35;
    reasons.push("四角循環交易");
  } else {
    score += 30;
    reasons.push(`${cycle.length}角循環交易`);
  }

  if (total_amount > 100000) {
    score += 30;
    reasons.push(`循環總金額高 (${total_amount.toLocaleString()} 元)`);
  }

  if (total_count > 50) {
    score += 30;
    reasons.push(`循環交易頻繁 (${total_count} 次)`);
  }

  return { total_amount, avg_amount, suspicion_score: score, reasons };
}

/**
 * 去除重複的循環（不同起點的相同循環）
 */
function deduplicateCycles(cycles: CyclePattern[]): CyclePattern[] {
  const seen = new Set<string>();
  const unique: CyclePattern[] = [];

  cycles.forEach((cycle) => {
    // 正規化循環（從最小 ID 開始）
    const normalized = normalizeCycle(cycle.cycle);
    const key = normalized.join("-");

    if (!seen.has(key)) {
      seen.add(key);
      unique.push(cycle);
    }
  });

  return unique;
}

/**
 * 正規化循環（從最小 ID 開始）
 */
function normalizeCycle(cycle: string[]): string[] {
  const minIndex = cycle.indexOf(
    cycle.reduce((min, id) => (id < min ? id : min))
  );
  return [...cycle.slice(minIndex), ...cycle.slice(0, minIndex)];
}

/**
 * 檢測同時活躍的帳號群組
 * 如果多個帳號總是在相似時間使用指令，可能是同一人操作
 */
export interface TimePattern {
  accounts: string[];
  correlation_score: number; // 0-1，越高越可疑
  suspicion_score: number;
  reasons: string[];
}

/**
 * 計算兩個帳號的活躍時間相關性
 * 需要從 command_usage_stats 查詢時間資料
 */
export function calculateTimeCorrelation(
  account1Times: Date[],
  account2Times: Date[]
): number {
  if (account1Times.length === 0 || account2Times.length === 0) return 0;

  // 計算時間重疊度
  let overlaps = 0;
  const timeWindow = 5 * 60 * 1000; // 5 分鐘窗口

  account1Times.forEach((time1) => {
    const hasOverlap = account2Times.some((time2) => {
      return Math.abs(time1.getTime() - time2.getTime()) < timeWindow;
    });
    if (hasOverlap) overlaps++;
  });

  return overlaps / Math.max(account1Times.length, account2Times.length);
}
