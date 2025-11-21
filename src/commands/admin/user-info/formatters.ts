/**
 * 格式化工具函數
 */

import {
  UserTopGuild,
  UserTopCommand,
  UserTransaction,
  SpendingBreakdown,
  PortfolioItem,
  TopSender,
  TopReceiver,
  CommandUsagePattern,
  UserInfoData,
} from "../../../shared/database/types";
import { Client } from "discord.js";

/**
 * 交易類型中文映射表
 * 從資料庫 balance_history.transaction_type 查詢得到
 */
export const TRANSACTION_TYPE_MAP: { [key: string]: string } = {
  // AI 相關
  ai_character_creation: "AI 角色創建",
  ai_slot_expansion: "AI 欄位擴充",

  // 煉金術
  alchemy: "煉金術",

  // 卡片相關
  "card:enhance_star": "卡片升星",
  draw: "抽卡",
  sell_card: "出售卡片",

  // 優惠券
  coupons: "優惠券",

  // 自訂主題
  custom_theme_publish: "發布自訂主題",

  // 開發指令
  dev_command: "開發指令",

  // 股市相關
  DELISTED_SETTLEMENT: "下市結算",
  FORCED_COVER: "強制補回",
  "stock:buy": "股票買入",
  "stock:cover": "股票補回",
  "stock:sell": "股票賣出",
  "stock:short": "股票做空",
  stock_buyback: "股票回購",

  // 遊戲：百家樂
  "game:baccarat_bet": "百家樂投注",
  "game:baccarat_refund": "百家樂退款",
  "game:baccarat_win": "百家樂獲勝",

  // 遊戲：二十一點
  "game:blackjack_bet": "二十一點投注",
  "game:blackjack_win": "二十一點獲勝",

  // 遊戲：崩潰遊戲
  "game:crash_bet": "崩潰遊戲投注",
  "game:crash_win": "崩潰遊戲獲勝",

  // 遊戲：骰子
  "game:dice_bet": "骰子投注",
  "game:dice_win": "骰子獲勝",

  // 遊戲：踩地雷
  "game:mines_bet": "踩地雷投注",
  "game:mines_special_reward": "踩地雷特殊獎勵",
  "game:mines_win": "踩地雷獲勝",

  // 遊戲：單挑撲克
  "game:poker1v1_buy_in": "單挑撲克買入",
  "game:poker1v1_refund": "單挑撲克退款",
  "game:poker1v1_settlement": "單挑撲克結算",

  // 遊戲：刮刮樂
  "game:scratch_bet": "刮刮樂投注",
  "game:scratch_win": "刮刮樂獲勝",

  // 遊戲：老虎機
  "game:slot_bet": "老虎機投注",
  "game:slot_win": "老虎機獲勝",

  // 遊戲：輪盤
  "game:spin_bet": "輪盤投注",
  "game:spin_win": "輪盤獲勝",

  // 遊戲：爬塔
  "game:tower_bet": "爬塔投注",
  "game:tower_cashout": "爬塔兌現",
  "game:tower_win": "爬塔獲勝",

  // 獎勵
  "reward:daily": "每日獎勵",
  "reward:hourly": "每小時獎勵",

  // 交易
  "trade:buy": "交易買入",
  "trade:sell": "交易賣出",

  // 轉帳
  transfer_receive: "接收轉帳",
  transfer_send: "發送轉帳",

  // 願望
  "wish:expand_slot": "擴充許願欄位",
  "wish:upgrade_power": "升級許願能量",

  // 其他（舊版或未分類）
  unknown: "其他",
  OIL_TRANSFER: "油幣轉帳",
  GACHA_PULL: "扭蛋",
  ASSET_PURCHASE: "資產購買",
  ASSET_SALE: "資產出售",
  ADMIN_ADJUSTMENT: "管理員調整",
  DAILY_REWARD: "每日簽到",
};

/**
 * 格式化時間（毫秒）為可讀格式
 */
export function formatExecutionTime(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * 格式化時間間隔（秒）為可讀格式
 */
export function formatInterval(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)}秒`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)}分鐘`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}小時`;
  return `${(seconds / 86400).toFixed(1)}天`;
}

/**
 * 計算變異係數（CV）來判斷使用模式的穩定性
 */
export function calculateCV(stddev: number, mean: number): number {
  if (mean === 0) return 0;
  return (stddev / mean) * 100;
}

/**
 * 格式化交易紀錄
 */
export function formatTransactions(
  transactions: UserTransaction[],
  targetUserId: string
): string {
  return transactions.length > 0
    ? transactions
        .map((tx: UserTransaction) => {
          const isSender = tx.sender_id === targetUserId;
          const otherPartyId = isSender ? tx.receiver_id : tx.sender_id;
          const arrow = isSender ? "🢂" : "🢀";
          const action = isSender ? "轉給" : "收到";
          const timestamp = `<t:${Math.floor(
            new Date(tx.created_at).getTime() / 1000
          )}:R>`;
          return `${arrow} ${action} <@${otherPartyId}> - **${tx.amount.toLocaleString()}** 元 (${timestamp})`;
        })
        .join("\n")
    : "無紀錄";
}

/**
 * 格式化支出/收入分類
 */
export function formatBreakdown(
  breakdown: SpendingBreakdown[],
  title: string
): string {
  if (breakdown.length === 0) return "無紀錄";

  const categoryMap: {
    [key: string]: { name: string; items: SpendingBreakdown[] };
  } = {
    game: { name: "🎮 遊戲", items: [] },
    reward: { name: "🎁 獎勵", items: [] },
    stock: { name: "📈 股市", items: [] },
    trade: { name: "🔄 交易", items: [] },
    card: { name: "🃏 卡牌", items: [] },
    wish: { name: "⭐ 願望", items: [] },
    transfer: { name: "💸 轉帳", items: [] },
    ai: { name: "🤖 AI", items: [] },
    custom: { name: "🎨 自訂", items: [] },
    other: { name: "📦 其他", items: [] },
  };

  breakdown.forEach((item) => {
    const type = item.transaction_type;
    if (type.startsWith("game:")) categoryMap.game.items.push(item);
    else if (type.startsWith("reward:")) categoryMap.reward.items.push(item);
    else if (type.startsWith("stock:") || type === "DELISTED_SETTLEMENT" || type === "FORCED_COVER" || type === "stock_buyback")
      categoryMap.stock.items.push(item);
    else if (type.startsWith("trade:")) categoryMap.trade.items.push(item);
    else if (type.startsWith("card:") || type === "draw" || type === "sell_card")
      categoryMap.card.items.push(item);
    else if (type.startsWith("wish:")) categoryMap.wish.items.push(item);
    else if (type.includes("transfer")) categoryMap.transfer.items.push(item);
    else if (type.startsWith("ai_")) categoryMap.ai.items.push(item);
    else if (type.startsWith("custom_")) categoryMap.custom.items.push(item);
    else categoryMap.other.items.push(item);
  });

  let result = "";
  let totalAmount = 0;

  Object.values(categoryMap).forEach((category) => {
    if (category.items.length > 0) {
      const categoryTotal = category.items.reduce(
        (sum, item) => sum + item.total_amount,
        0
      );
      totalAmount += categoryTotal;
      result += `\n### ${category.name} (${categoryTotal.toLocaleString()} 元)\n`;
      category.items
        .sort((a, b) => b.total_amount - a.total_amount)
        .slice(0, 5)
        .forEach((item) => {
          const displayName =
            TRANSACTION_TYPE_MAP[item.transaction_type] ||
            item.transaction_type;
          result += `- ${displayName}: **${item.total_amount.toLocaleString()}** 元\n`;
        });
    }
  });

  return `**總計: ${totalAmount.toLocaleString()} 元**\n${result}`;
}

/**
 * 格式化投資組合
 */
export function formatPortfolio(portfolio: PortfolioItem[]): string {
  if (portfolio.length === 0) return "無持有股票";

  const totalValue = portfolio.reduce((sum, item) => sum + item.total_value, 0);
  const portfolioList = portfolio
    .sort((a, b) => b.total_value - a.total_value)
    .slice(0, 15)
    .map((item, i) => {
      const percentage = ((item.total_value / totalValue) * 100).toFixed(1);
      return `${i + 1}. **${item.asset_name}** - ${item.quantity} 股\n   市值: ${item.total_value.toLocaleString()} 元 (${percentage}%)`;
    })
    .join("\n");

  return `**總市值: ${totalValue.toLocaleString()} 元**\n\n${portfolioList}`;
}

/**
 * 格式化互動列表
 */
export function formatInteractionList(
  list: (TopSender | TopReceiver)[],
  type: "sender" | "receiver",
  sortBy: "count" | "amount" = "amount"
): string {
  if (list.length === 0) return "無紀錄";

  // 排序
  const sortedList = [...list].sort((a, b) => {
    if (sortBy === "count") return b.count - a.count;
    return b.total_amount - a.total_amount;
  });

  const totalAmount = sortedList.reduce(
    (sum, item) => sum + item.total_amount,
    0
  );
  const totalCount = sortedList.reduce((sum, item) => sum + item.count, 0);

  const medals = ["🥇", "🥈", "🥉"];
  const listContent = sortedList
    .map((item, i) => {
      const userId =
        type === "sender"
          ? (item as TopSender).sender_id
          : (item as TopReceiver).receiver_id;
      const medal = i < 3 ? medals[i] : `${i + 1}.`;
      const avgAmount = (item.total_amount / item.count).toFixed(0);
      const percentage = ((item.total_amount / totalAmount) * 100).toFixed(1);

      return (
        `${medal} <@${userId}>\n` +
        `   💰 總金額: **${item.total_amount.toLocaleString()}** 元 (${percentage}%)\n` +
        `   🔢 次數: ${item.count} 次 | 平均: ${Number(avgAmount).toLocaleString()} 元/次`
      );
    })
    .join("\n\n");

  const sortLabel = sortBy === "count" ? "次數" : "金額";
  return (
    `**排序方式: ${sortLabel}**\n\n` +
    `**統計總計**\n` +
    `- 總金額: ${totalAmount.toLocaleString()} 元\n` +
    `- 總次數: ${totalCount} 次\n` +
    `- 平均: ${(totalAmount / totalCount).toFixed(0)} 元/次\n\n` +
    `---\n\n${listContent}`
  );
}

/**
 * 格式化最活躍伺服器
 */
export function formatTopGuilds(
  topGuilds: UserTopGuild[],
  client: Client
): string {
  return topGuilds.length > 0
    ? topGuilds
        .map((g: UserTopGuild, i: number) => {
          const guild = client.guilds.cache.get(g.guild_id);
          return `${i + 1}. ${guild ? `${guild.name}` : g.guild_id} (${
            g.usage_count
          } 次)`;
        })
        .join("\n")
    : "無紀錄";
}

/**
 * 格式化最常用指令
 */
export function formatTopCommands(topCommands: UserTopCommand[]): string {
  return topCommands.length > 0
    ? topCommands
        .map(
          (c: UserTopCommand, i: number) =>
            `${i + 1}. \`${c.command_name}\` - ${c.usage_count} 次`
        )
        .join("\n")
    : "無紀錄";
}
