import {
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  UserContextMenuCommandInteraction,
  Locale,
  PermissionsBitField,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  DiscordAPIError,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import { Command } from "../../../interfaces/Command";
import { getLocalizations } from "../../../utils/localization";
import { errorHandler } from "../../../utils/errorHandler";
import logger from "../../../utils/logger";
import {
  getUserInfoData,
  getRecentTransactions,
  getCommandUsagePatterns,
  getCommandUsageFrequency,
} from "../../../repositories/user.repository";
import {
  UserTopGuild,
  UserTopCommand,
  UserTransaction,
  SpendingBreakdown,
  PortfolioItem,
  TopSender,
  TopReceiver,
  CommandUsagePattern,
} from "../../../shared/database/types";

import { Databases, Services } from "../../../interfaces/Command";

function formatExecutionTime(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatInterval(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)}秒`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)}分鐘`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}小時`;
  return `${(seconds / 86400).toFixed(1)}天`;
}

function calculateCV(stddev: number, mean: number): number {
  if (mean === 0) return 0;
  return (stddev / mean) * 100;
}

function getSuspicionLevel(pattern: CommandUsagePattern): {
  level: "正常" | "可疑" | "高度可疑";
  reasons: string[];
} {
  const reasons: string[] = [];
  let suspicionScore = 0;

  if (pattern.avg_interval_seconds > 0) {
    const intervalCV = calculateCV(
      pattern.interval_stddev_seconds,
      pattern.avg_interval_seconds
    );
    if (intervalCV < 10 && pattern.usage_count > 10) {
      suspicionScore += 3;
      reasons.push(`使用間隔過於規律 (CV: ${intervalCV.toFixed(1)}%)`);
    }

    if (pattern.avg_interval_seconds < 5 && pattern.usage_count > 20) {
      suspicionScore += 3;
      reasons.push(
        `使用頻率異常高 (平均間隔: ${formatInterval(pattern.avg_interval_seconds)})`
      );
    }

    if (pattern.avg_interval_seconds < 2 && pattern.usage_count > 10) {
      suspicionScore += 2;
      reasons.push(`疑似使用自動化工具 (平均間隔 < 2秒)`);
    }
  }

  if (pattern.usage_count > 200) {
    suspicionScore += 2;
    reasons.push(`使用次數異常多 (${pattern.usage_count}次)`);
  } else if (pattern.usage_count > 100) {
    suspicionScore += 1;
    reasons.push(`使用次數偏高 (${pattern.usage_count}次)`);
  }

  const timeSpanDays =
    (new Date(pattern.last_used_at).getTime() -
      new Date(pattern.first_used_at).getTime()) /
    (1000 * 60 * 60 * 24);
  if (timeSpanDays > 0 && pattern.usage_count / timeSpanDays > 50) {
    suspicionScore += 1;
    reasons.push(
      `每日平均使用次數過高 (${(pattern.usage_count / timeSpanDays).toFixed(1)}次/天)`
    );
  }

  if (suspicionScore >= 5) return { level: "高度可疑", reasons };
  if (suspicionScore >= 3) return { level: "可疑", reasons };
  return { level: "正常", reasons: [] };
}

export const command: Command = {
  data: new ContextMenuCommandBuilder()
    .setName("userinfo")
    .setNameLocalizations({
      [Locale.EnglishUS]: "userinfo",
      [Locale.ChineseTW]: "使用者資訊",
    })
    .setType(ApplicationCommandType.User)
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
  async execute(
    interaction: UserContextMenuCommandInteraction,
    _client,
    services: Services,
    _databases: Databases
  ) {
    const { localizationManager } = services;
    const translations = getLocalizations(localizationManager, "userinfo");
    const t = translations[interaction.locale] ?? translations["en-US"];
    const targetUser = interaction.targetUser;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const [userInfo, usagePatterns, recentFrequency] = await Promise.all([
      getUserInfoData(targetUser.id),
      getCommandUsagePatterns(targetUser.id),
      getCommandUsageFrequency(targetUser.id, 60),
    ]);

    let recent_transactions = await getRecentTransactions(targetUser.id, 0, 15);

    const createGeneralContent = () => {
      const topGuildsContent =
        userInfo.top_guilds.length > 0
          ? userInfo.top_guilds
              .map((g: UserTopGuild, i: number) => {
                const guild = interaction.client.guilds.cache.get(g.guild_id);
                return `${i + 1}. ${guild ? `${guild.name}` : g.guild_id} (${
                  g.usage_count
                } 次)`;
              })
              .join("\n")
          : "無紀錄";

      const topCommandsContent =
        userInfo.top_commands.length > 0
          ? userInfo.top_commands
              .map(
                (c: UserTopCommand, i: number) =>
                  `${i + 1}. \`${c.command_name}\` - ${c.usage_count} 次`
              )
              .join("\n")
          : "無紀錄";

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
    };

    const createFinancialContent = () => {
      const transactionTypeMap: { [key: string]: string } = {
        DELISTED_SETTLEMENT: "下市結算",
        "card:enhance_star": "卡片升星",
        draw: "抽卡",
        "game:baccarat_bet": "百家樂投注",
        "game:baccarat_refund": "百家樂退款",
        "game:baccarat_win": "百家樂獲勝",
        "game:blackjack_bet": "二十一點投注",
        "game:blackjack_win": "二十一點獲勝",
        "game:dice_bet": "骰子投注",
        "game:dice_win": "骰子獲勝",
        "game:mines_bet": "踩地雷投注",
        "game:mines_special_reward": "踩地雷特殊獎勵",
        "game:mines_win": "踩地雷獲勝",
        "game:poker1v1_buy_in": "單挑撲克買入",
        "game:poker1v1_settlement": "單挑撲克結算",
        "game:slot_bet": "老虎機投注",
        "game:slot_win": "老虎機獲勝",
        "game:spin_bet": "輪盤投注",
        "game:spin_win": "輪盤獲勝",
        "game:tower_bet": "爬塔投注",
        "game:tower_cashout": "爬塔兌現",
        "game:tower_win": "爬塔獲勝",
        "reward:daily": "每日獎勵",
        "reward:hourly": "每小時獎勵",
        sell_card: "出售卡片",
        "stock:buy": "股票買入",
        "stock:cover": "股票補回",
        "stock:sell": "股票賣出",
        "stock:short": "股票做空",
        "trade:buy": "交易買入",
        "trade:sell": "交易賣出",
        transfer_receive: "接收轉帳",
        transfer_send: "發送轉帳",
        unknown: "其他",
        "wish:expand_slot": "擴充許願欄位",
        "wish:upgrade_power": "升級許願能量",
        OIL_TRANSFER: "油幣轉帳",
        GACHA_PULL: "扭蛋",
        ASSET_PURCHASE: "資產購買",
        ASSET_SALE: "資產出售",
        ADMIN_ADJUSTMENT: "管理員調整",
        DAILY_REWARD: "每日簽到",
      };

      const formatBreakdown = (breakdown: SpendingBreakdown[], title: string) => {
        if (breakdown.length === 0) return "無紀錄";

        const categoryMap: { [key: string]: { name: string; items: SpendingBreakdown[] } } = {
          game: { name: "🎮 遊戲", items: [] },
          reward: { name: "🎁 獎勵", items: [] },
          stock: { name: "📈 股市", items: [] },
          trade: { name: "🔄 交易", items: [] },
          card: { name: "🃏 卡牌", items: [] },
          wish: { name: "⭐ 願望", items: [] },
          transfer: { name: "💸 轉帳", items: [] },
          other: { name: "📦 其他", items: [] },
        };

        breakdown.forEach((item) => {
          const type = item.transaction_type;
          if (type.startsWith("game:")) categoryMap.game.items.push(item);
          else if (type.startsWith("reward:")) categoryMap.reward.items.push(item);
          else if (type.startsWith("stock:")) categoryMap.stock.items.push(item);
          else if (type.startsWith("trade:")) categoryMap.trade.items.push(item);
          else if (type.startsWith("card:")) categoryMap.card.items.push(item);
          else if (type.startsWith("wish:")) categoryMap.wish.items.push(item);
          else if (type.includes("transfer")) categoryMap.transfer.items.push(item);
          else categoryMap.other.items.push(item);
        });

        let result = "";
        let totalAmount = 0;

        Object.values(categoryMap).forEach((category) => {
          if (category.items.length > 0) {
            const categoryTotal = category.items.reduce((sum, item) => sum + item.total_amount, 0);
            totalAmount += categoryTotal;
            result += `\n### ${category.name} (${categoryTotal.toLocaleString()} 元)\n`;
            category.items
              .sort((a, b) => b.total_amount - a.total_amount)
              .slice(0, 5)
              .forEach((item) => {
                const displayName = transactionTypeMap[item.transaction_type] || item.transaction_type;
                result += `- ${displayName}: **${item.total_amount.toLocaleString()}** 元\n`;
              });
          }
        });

        return `**總計: ${totalAmount.toLocaleString()} 元**\n${result}`;
      };

      const portfolioContent = () => {
        if (userInfo.portfolio.length === 0) return "無持有股票";

        const totalValue = userInfo.portfolio.reduce((sum, item) => sum + item.total_value, 0);
        const portfolioList = userInfo.portfolio
          .sort((a, b) => b.total_value - a.total_value)
          .slice(0, 15)
          .map((item, i) => {
            const percentage = ((item.total_value / totalValue) * 100).toFixed(1);
            return `${i + 1}. **${item.asset_name}** - ${item.quantity} 股\n   市值: ${item.total_value.toLocaleString()} 元 (${percentage}%)`;
          })
          .join("\n");

        return `**總市值: ${totalValue.toLocaleString()} 元**\n\n${portfolioList}`;
      };

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
        `## 📊 股票投資組合\n${portfolioContent()}`
      );
    };

    const createInteractionsContent = () => {
      const formatInteractionList = (
        list: (TopSender | TopReceiver)[],
        type: "sender" | "receiver"
      ) => {
        if (list.length === 0) return "無紀錄";

        const totalAmount = list.reduce((sum, item) => sum + item.total_amount, 0);
        const totalCount = list.reduce((sum, item) => sum + item.count, 0);

        const medals = ["🥇", "🥈", "🥉"];
        const listContent = list
          .map((item, i) => {
            const userId = type === "sender" ? (item as TopSender).sender_id : (item as TopReceiver).receiver_id;
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

        return (
          `**統計總計**\n` +
          `- 總金額: ${totalAmount.toLocaleString()} 元\n` +
          `- 總次數: ${totalCount} 次\n` +
          `- 平均: ${(totalAmount / totalCount).toFixed(0)} 元/次\n\n` +
          `---\n\n${listContent}`
        );
      };

      return (
        `# 🤝 ${targetUser.username} 的互動排行\n\n` +
        `## 🎁 最常轉帳給您的人 (Top 10)\n${formatInteractionList(userInfo.top_senders, "sender")}\n\n` +
        `## 💸 您最常轉帳的人 (Top 10)\n${formatInteractionList(userInfo.top_receivers, "receiver")}`
      );
    };

    const createUsagePatternContent = () => {
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
    };

    const formatTransactions = (transactions: UserTransaction[]) =>
      transactions.length > 0
        ? transactions
            .map((tx: UserTransaction) => {
              const isSender = tx.sender_id === targetUser.id;
              const otherPartyId = isSender ? tx.receiver_id : tx.sender_id;
              const arrow = isSender ? "🢂" : "🢀";
              const action = isSender ? "轉給" : "收到";
              const timestamp = `<t:${Math.floor(
                new Date(tx.created_at).getTime() / 1000
              )}:R>`;
              return `${arrow} ${action} <@${otherPartyId}> - **${tx.amount}** 元 (${timestamp})`;
            })
            .join("\n")
        : "無紀錄";

    const createDetailsContent = () => {
      const recentTransactionsContent = formatTransactions(recent_transactions);

      return (
        `# 📝 ${targetUser.username} 的詳細記錄\n\n` +
        `## 💳 最近交易紀錄\n${recentTransactionsContent}\n\n` +
        `## 🃏 卡片收藏總覽\n` +
        `- 總持有卡片數量: **${userInfo.total_cards}** 張`
      );
    };

    const contentMap: { [key: string]: () => string } = {
      general: createGeneralContent,
      financial: createFinancialContent,
      interactions: createInteractionsContent,
      usage_pattern: createUsagePatternContent,
      details: createDetailsContent,
    };

    let currentView = "general";

    const createSelectMenu = () => {
      return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("view_selector")
          .setPlaceholder("選擇要查看的資訊類別")
          .addOptions(
            new StringSelectMenuOptionBuilder()
              .setLabel("綜合資訊")
              .setDescription("查看使用者的基本資訊和活動統計")
              .setValue("general")
              .setEmoji("📊")
              .setDefault(currentView === "general"),
            new StringSelectMenuOptionBuilder()
              .setLabel("財務總覽")
              .setDescription("查看帳戶餘額、交易統計和投資組合")
              .setValue("financial")
              .setEmoji("💰")
              .setDefault(currentView === "financial"),
            new StringSelectMenuOptionBuilder()
              .setLabel("互動排行")
              .setDescription("查看最常互動的使用者")
              .setValue("interactions")
              .setEmoji("🤝")
              .setDefault(currentView === "interactions"),
            new StringSelectMenuOptionBuilder()
              .setLabel("使用模式分析")
              .setDescription("分析指令使用模式，檢測異常行為")
              .setValue("usage_pattern")
              .setEmoji("🔍")
              .setDefault(currentView === "usage_pattern"),
            new StringSelectMenuOptionBuilder()
              .setLabel("詳細記錄")
              .setDescription("查看交易記錄和卡片收藏")
              .setValue("details")
              .setEmoji("📝")
              .setDefault(currentView === "details")
          )
      );
    };

    const createActionButtons = () => {
      return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("refresh_data")
          .setLabel("🔄 重新整理")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("export_report")
          .setLabel("📄 匯出報告")
          .setStyle(ButtonStyle.Primary)
      );
    };

    const message = await interaction.editReply({
      content: contentMap[currentView](),
      components: [createSelectMenu(), createActionButtons()],
    });

    const collector = message.createMessageComponentCollector({
      time: 300000,
    });

    collector.on("collect", async (i) => {
      try {
        if (i.user.id !== interaction.user.id) {
          await i.reply({
            content: "這不是給您用的按鈕！",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        if (i.isStringSelectMenu() && i.customId === "view_selector") {
          currentView = i.values[0];
          await i.update({
            content: contentMap[currentView](),
            components: [createSelectMenu(), createActionButtons()],
          });
        } else if (i.isButton()) {
          if (i.customId === "refresh_data") {
            await i.deferUpdate();
            const [newUserInfo, newUsagePatterns, newRecentFrequency] =
              await Promise.all([
                getUserInfoData(targetUser.id),
                getCommandUsagePatterns(targetUser.id),
                getCommandUsageFrequency(targetUser.id, 60),
              ]);
            Object.assign(userInfo, newUserInfo);
            usagePatterns.length = 0;
            usagePatterns.push(...newUsagePatterns);
            recentFrequency.length = 0;
            recentFrequency.push(...newRecentFrequency);

            await i.editReply({
              content: contentMap[currentView](),
              components: [createSelectMenu(), createActionButtons()],
            });
          } else if (i.customId === "export_report") {
            await i.reply({
              content: "📄 報告匯出功能開發中...",
              flags: MessageFlags.Ephemeral,
            });
          }
        }
      } catch (error) {
        errorHandler.handleInteractionError(
          i,
          error,
          interaction.client,
          services
        );
      }
    });

    collector.on("end", async () => {
      try {
        // Simply disable all components
        await message.edit({
          components: [],
        });
      } catch (error) {
        if (error instanceof DiscordAPIError && error.code === 10062) {
          return;
        }
        logger.warn(
          `[user-info] Failed to disable components on collector end: ${error}`
        );
      }
    });
  },
};
