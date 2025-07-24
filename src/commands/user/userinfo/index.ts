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
} from "discord.js";
import { Command } from "../../../interfaces/Command";
import { getLocalizations } from "../../../utils/localization";
import {
  getUserInfoData,
  UserTopGuild,
  UserTopCommand,
  UserTransaction,
  SpendingBreakdown,
  PortfolioItem,
  TopSender,
  TopReceiver,
} from "../../../shared/database/queries";
import { gachaPool } from "../../../shared/database";

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
  async execute(interaction: UserContextMenuCommandInteraction) {
    const t = translations[interaction.locale] ?? translations["en-US"];
    const targetUser = interaction.targetUser;

    const {
      top_guilds,
      top_commands,
      recent_transactions,
      total_cards,
      total_spent,
      total_received,
      spending_breakdown,
      portfolio,
      top_senders,
      top_receivers,
    } = await getUserInfoData(gachaPool, targetUser.id);

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

    const recentTransactionsContent =
      recent_transactions.length > 0
        ? recent_transactions
            .map((tx: UserTransaction) => {
              const isSender = tx.sender_id === targetUser.id;
              const otherPartyId = isSender ? tx.receiver_id : tx.sender_id;
              const arrow = isSender ? "➡️" : "⬅️";
              const action = isSender ? "轉給" : "收到";
              const timestamp = `<t:${Math.floor(
                new Date(tx.created_at).getTime() / 1000
              )}:R>`;
              return `${arrow} ${action} <@${otherPartyId}> - ${tx.amount} 元 (${timestamp})`;
            })
            .join("\n")
        : "無紀錄";

    const spendingBreakdownContent =
      spending_breakdown.length > 0
        ? spending_breakdown
            .map(
              (item: SpendingBreakdown) =>
                `${item.transaction_type}: ${item.total_amount} 元`
            )
            .join("\n")
        : "無紀錄";

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
            name: "💸 總轉入/總轉出",
            value: `總轉入: ${total_received} 元\n總轉出: ${total_spent} 元`,
            inline: false,
          },
          {
            name: "🧾 油幣花費項目",
            value: spendingBreakdownContent,
            inline: false,
          },
          { name: "📈 股票投資組合", value: portfolioContent, inline: false }
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
            value: recentTransactionsContent,
            inline: false,
          },
          {
            name: "🃏 卡片收藏總覽",
            value: `總持有卡片數量： ${total_cards} 張`,
            inline: false,
          }
        ),
    };

    const createActionRow = (activeCategory: string) => {
      return new ActionRowBuilder<ButtonBuilder>().addComponents(
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
    };

    const message = await interaction.reply({
      embeds: [embeds["general"]],
      components: [createActionRow("general")],
      flags: MessageFlags.Ephemeral,
    });

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60000, // 60 seconds
    });

    collector.on("collect", async (i) => {
      if (i.user.id !== interaction.user.id) {
        await i.reply({ content: "這不是給您用的按鈕！", ephemeral: true });
        return;
      }

      const category = i.customId.split("_")[1];
      await i.update({
        embeds: [embeds[category]],
        components: [createActionRow(category)],
      });
    });

    collector.on("end", async () => {
      const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("show_general_disabled")
          .setLabel("綜合資訊")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId("show_financial_disabled")
          .setLabel("財務總覽")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId("show_interactions_disabled")
          .setLabel("互動排行")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId("show_details_disabled")
          .setLabel("詳細記錄")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true)
      );
      await message.edit({ components: [disabledRow] });
    });
  },
};
