import {
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  UserContextMenuCommandInteraction,
  Locale,
  EmbedBuilder,
  PermissionsBitField,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  DiscordAPIError,
} from "discord.js";
import { Command } from "../../../interfaces/Command";
import { getLocalizations } from "../../../utils/localization";
import { errorHandler } from "../../../utils/errorHandler";
import logger from "../../../utils/logger";
import {
  getUserInfoData,
  getRecentTransactions,
  UserTopGuild,
  UserTopCommand,
  UserTransaction,
  SpendingBreakdown,
  PortfolioItem,
  TopSender,
  TopReceiver,
} from "../../../shared/database/queries";

import { Databases, Services } from "../../../interfaces/Command";

const translations = getLocalizations("userinfo");

export const command: Command = {
  data: new ContextMenuCommandBuilder()
    .setName(translations["en-US"].name)
    .setNameLocalizations({
      [Locale.EnglishUS]: translations["en-US"].name,
      [Locale.ChineseTW]: translations["zh-TW"].name,
    })
    .setType(ApplicationCommandType.User)
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
  async execute(
    interaction: UserContextMenuCommandInteraction,
    _client,
    _services: Services,
    _databases: Databases
  ) {
    const t = translations[interaction.locale] ?? translations["en-US"];
    const targetUser = interaction.targetUser;

    const {
      top_guilds,
      top_commands,
      total_cards,
      total_transactions_count,
      total_spent,
      total_received,
      spending_breakdown,
      income_breakdown,
      portfolio,
      top_senders,
      top_receivers,
      oil_balance,
      oil_ticket_balance,
    } = await getUserInfoData(targetUser.id);

    let recent_transactions = await getRecentTransactions(targetUser.id, 0, 15);

    const topGuildsContent =
      top_guilds.length > 0
        ? top_guilds
            .map((g: UserTopGuild, i: number) => {
              const guild = interaction.client.guilds.cache.get(g.guild_id);
              return `${i + 1}. ${guild ? `${guild.name}` : g.guild_id} (${
                g.usage_count
              } 次)`;
            })
            .join("\n")
        : "無紀錄";

    const topCommandsContent =
      top_commands.length > 0
        ? top_commands
            .map(
              (c: UserTopCommand, i: number) =>
                `${i + 1}. ${c.command_name} (${c.usage_count} 次)`
            )
            .join("\n")
        : "無紀錄";

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
              return `${arrow} ${action} <@${otherPartyId}> - ${tx.amount} 元 (${timestamp})`;
            })
            .join("\n")
        : "無紀錄";

    let recentTransactionsContent = formatTransactions(recent_transactions);
    if (recentTransactionsContent.length > 1024) {
      recentTransactionsContent =
        recentTransactionsContent.substring(0, 1020) + "\n...";
    }

    const transactionTypeMap: { [key: string]: string } = {
      DELISTED_SETTLEMENT: "下市結算",
      "card:enhance_star": "卡片升星",
      draw: "抽卡",
      "game:baccarat_bet": "遊戲：百家樂投注",
      "game:baccarat_refund": "遊戲：百家樂退款",
      "game:baccarat_win": "遊戲：百家樂獲勝",
      "game:blackjack_bet": "遊戲：二十一點投注",
      "game:blackjack_win": "遊戲：二十一點獲勝",
      "game:dice_bet": "遊戲：骰子投注",
      "game:dice_win": "遊戲：骰子獲勝",
      "game:mines_bet": "遊戲：踩地雷投注",
      "game:mines_special_reward": "遊戲：踩地雷特殊獎勵",
      "game:mines_win": "遊戲：踩地雷獲勝",
      "game:poker1v1_buy_in": "遊戲：單挑撲克買入",
      "game:poker1v1_settlement": "遊戲：單挑撲克結算",
      "game:slot_bet": "遊戲：老虎機投注",
      "game:slot_win": "遊戲：老虎機獲勝",
      "game:spin_bet": "遊戲：輪盤投注",
      "game:spin_win": "遊戲：輪盤獲勝",
      "game:tower_bet": "遊戲：爬塔投注",
      "game:tower_cashout": "遊戲：爬塔兌現",
      "game:tower_win": "遊戲：爬塔獲勝",
      "reward:daily": "每日獎勵",
      "reward:hourly": "每小時獎勵",
      sell_card: "出售卡片",
      "stock:buy": "股票：買入",
      "stock:cover": "股票：補回",
      "stock:sell": "股票：賣出",
      "stock:short": "股票：做空",
      "trade:buy": "交易：買入",
      "trade:sell": "交易：賣出",
      transfer_receive: "接收轉帳",
      transfer_send: "發送轉帳",
      unknown: "轉帳",
      "wish:expand_slot": "擴充許願欄位",
      "wish:upgrade_power": "升級許願能量",
      OIL_TRANSFER: "油幣轉帳",
      GACHA_PULL: "扭蛋",
      ASSET_PURCHASE: "資產購買",
      ASSET_SALE: "資產出售",
      ADMIN_ADJUSTMENT: "管理員調整",
      DAILY_REWARD: "每日簽到",
    };

    const formatBreakdown = (breakdown: SpendingBreakdown[]) => {
      if (breakdown.length === 0) {
        return "無紀錄";
      }

      const categoryMap: { [key: string]: string } = {
        game: "遊戲",
        reward: "獎勵",
        stock: "股市",
        trade: "交易",
        card: "卡牌",
        wish: "願望",
        transfer: "轉帳",
        other: "其他",
      };

      const categorized: { [key: string]: string[] } = {};

      breakdown.forEach((item: SpendingBreakdown) => {
        const type = item.transaction_type;
        let category = "other";

        if (type.startsWith("game:")) category = "game";
        else if (type.startsWith("reward:")) category = "reward";
        else if (type.startsWith("stock:")) category = "stock";
        else if (type.startsWith("trade:")) category = "trade";
        else if (type.startsWith("card:")) category = "card";
        else if (type.startsWith("wish:")) category = "wish";
        else if (type.startsWith("transfer")) category = "transfer";

        if (!categorized[category]) {
          categorized[category] = [];
        }
        categorized[category].push(
          `  • ${
            transactionTypeMap[item.transaction_type] || item.transaction_type
          }: ${item.total_amount} 元`
        );
      });

      const formattedString = Object.keys(categorized)
        .sort((a, b) => {
          const order = Object.keys(categoryMap);
          return order.indexOf(a) - order.indexOf(b);
        })
        .map((category) => {
          const title = categoryMap[category] || "其他";
          return `\n=== ${title} ===\n${categorized[category].join("\n")}`;
        })
        .join("");

      if (formattedString.length > 1024) {
        return formattedString.substring(0, 1020) + "\n...";
      }
      return formattedString;
    };

    const spendingBreakdownContent = formatBreakdown(spending_breakdown);
    const incomeBreakdownContent = formatBreakdown(income_breakdown);

    const portfolioContent =
      portfolio.length > 0
        ? portfolio
            .map(
              (item: PortfolioItem) =>
                `${item.asset_name}: ${item.quantity} 股 (市值: ${item.total_value} 元)`
            )
            .join("\n")
        : "無紀錄";

    const topSendersContent =
      top_senders.length > 0
        ? top_senders
            .map(
              (sender: TopSender, i: number) =>
                `${i + 1}. <@${sender.sender_id}> - ${sender.count} 次 (共 ${
                  sender.total_amount
                } 元)`
            )
            .join("\n")
        : "無紀錄";

    const topReceiversContent =
      top_receivers.length > 0
        ? top_receivers
            .map(
              (receiver: TopReceiver, i: number) =>
                `${i + 1}. <@${receiver.receiver_id}> - ${
                  receiver.count
                } 次 (共 ${receiver.total_amount} 元)`
            )
            .join("\n")
        : "無紀錄";

    const embeds: { [key: string]: EmbedBuilder } = {
      general: new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(t.embed.title.replace("{username}", targetUser.username))
        .setThumbnail(targetUser.displayAvatarURL())
        .addFields(
          { name: t.embed.fields.tag, value: targetUser.tag, inline: true },
          { name: t.embed.fields.id, value: targetUser.id, inline: true },
          {
            name: t.embed.fields.createdAt,
            value: `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:R>`,
            inline: true,
          },
          { name: "📊 最活躍的伺服器", value: topGuildsContent, inline: false },
          { name: "🚀 最常用指令", value: topCommandsContent, inline: false }
        ),
      financial: new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(t.embed.title.replace("{username}", targetUser.username))
        .setThumbnail(targetUser.displayAvatarURL())
        .addFields(
          {
            name: "💰 帳戶餘額",
            value: `油幣: ${oil_balance} 元\n油票: ${oil_ticket_balance} 張`,
            inline: false,
          },
          {
            name: "💸 總轉入/總轉出",
            value: `總轉入: ${total_received} 元\n總轉出: ${total_spent} 元`,
            inline: false,
          },
          {
            name: "🧾 主要支出項目",
            value: spendingBreakdownContent,
            inline: false,
          },
          {
            name: "📈 主要收入來源",
            value: incomeBreakdownContent,
            inline: false,
          },
          { name: "📊 股票投資組合", value: portfolioContent, inline: false }
        ),
      interactions: new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(t.embed.title.replace("{username}", targetUser.username))
        .setThumbnail(targetUser.displayAvatarURL())
        .addFields(
          {
            name: "🎁 最常轉帳給您的人",
            value: topSendersContent,
            inline: false,
          },
          {
            name: "💸 您最常轉帳的人",
            value: topReceiversContent,
            inline: false,
          }
        ),
      details: new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(t.embed.title.replace("{username}", targetUser.username))
        .setThumbnail(targetUser.displayAvatarURL())
        .addFields(
          {
            name: "💳 最近交易紀錄",
            value: recentTransactionsContent || "無紀錄",
            inline: false,
          },
          {
            name: "🃏 卡片收藏總覽",
            value: `總持有卡片數量： ${total_cards} 張`,
            inline: false,
          }
        ),
    };

    const createActionRow = (
      activeCategory: string,
      currentOffset = 0,
      total = 0
    ) => {
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("show_general")
          .setLabel("綜合資訊")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(activeCategory === "general"),
        new ButtonBuilder()
          .setCustomId("show_financial")
          .setLabel("財務總覽")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(activeCategory === "financial"),
        new ButtonBuilder()
          .setCustomId("show_interactions")
          .setLabel("互動排行")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(activeCategory === "interactions"),
        new ButtonBuilder()
          .setCustomId("show_details")
          .setLabel("詳細記錄")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(activeCategory === "details")
      );

      if (activeCategory === "details") {
        const moreButton = new ButtonBuilder()
          .setCustomId(`details_more_${currentOffset + 15}`)
          .setLabel("查看更多")
          .setStyle(ButtonStyle.Success)
          .setDisabled(currentOffset + 15 >= total);
        row.addComponents(moreButton);
      }

      return row;
    };

    const message = await interaction.reply({
      embeds: [embeds["general"]],
      components: [createActionRow("general", 0, total_transactions_count)],
      flags: MessageFlags.Ephemeral,
    });

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      // time: 60000, // 60 seconds
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

        const [action, category, value] = i.customId.split("_");

        if (action === "details" && category === "more") {
          const offset = parseInt(value, 10);
          const newTransactions = await getRecentTransactions(
            targetUser.id,
            offset,
            15
          );

          if (newTransactions.length > 0) {
            const newContent = formatTransactions(newTransactions);
            if (embeds["details"].data.fields!.length < 25) {
              embeds["details"].addFields({
                name: `💳 最近交易紀錄 (續 ${offset / 15 + 1})`,
                value: newContent,
                inline: false,
              });
            }
          }

          await i.update({
            embeds: [embeds["details"]],
            components: [
              createActionRow("details", offset, total_transactions_count),
            ],
          });
          return;
        }

        if (action === "show") {
          await i.update({
            embeds: [embeds[category]],
            components: [
              createActionRow(category, 0, total_transactions_count),
            ],
          });
        }
      } catch (error) {
        errorHandler.handleInteractionError(i, error, interaction.client);
      }
    });

    collector.on("end", async () => {
      try {
        const finalMessage = await interaction.fetchReply();
        // Create a new disabled row
        const disabledRow = new ActionRowBuilder<ButtonBuilder>();
        for (const row of finalMessage.components) {
          if (row.type === ComponentType.ActionRow) {
            for (const component of row.components) {
              if (component.type === ComponentType.Button) {
                const newButton = new ButtonBuilder(component.data);
                newButton.setDisabled(true);
                disabledRow.addComponents(newButton);
              }
            }
          }
        }
        await message.edit({ components: [disabledRow] });
      } catch (error) {
        // Suppress errors on collector end, as the interaction may have expired
        if (error instanceof DiscordAPIError && error.code === 10062) {
          // Unknown interaction
          return;
        }
        logger.warn(
          `[user-info] Failed to disable components on collector end: ${error}`
        );
      }
    });
  },
};
