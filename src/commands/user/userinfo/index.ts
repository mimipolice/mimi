import {
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  UserContextMenuCommandInteraction,
  Locale,
  EmbedBuilder,
  PermissionsBitField,
  MessageFlags,
} from "discord.js";
import { Command } from "../../../interfaces/Command";
import { getLocalizations } from "../../../utils/localization";
import {
  getUserInfoData,
  UserTopGuild,
  UserTopCommand,
  UserTransaction,
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

    const { top_guilds, top_commands, recent_transactions, total_cards } =
      await getUserInfoData(gachaPool, targetUser.id);

    const topGuildsContent =
      top_guilds.length > 0
        ? top_guilds
            .map((g: UserTopGuild, i: number) => {
              const guild = interaction.client.guilds.cache.get(g.guild_id);
              return `${i + 1}. ${
                guild ? `${guild.id} ${guild.name}` : g.guild_id
              } - (${g.usage_count} 次)`;
            })
            .join("\n")
        : "無紀錄";

    const topCommandsContent =
      top_commands.length > 0
        ? top_commands
            .map(
              (c: UserTopCommand, i: number) =>
                `${i + 1}. ${c.command_name} - (${c.usage_count} 次)`
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
              return `${arrow} ${action} <@${otherPartyId}> - ${tx.amount} 元`;
            })
            .join("\n")
        : "無紀錄";

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(t.embed.title.replace("{username}", targetUser.username))
      .setThumbnail(targetUser.displayAvatarURL())
      .addFields(
        {
          name: t.embed.fields.tag,
          value: targetUser.tag,
          inline: true,
        },
        {
          name: t.embed.fields.id,
          value: targetUser.id,
          inline: true,
        },
        {
          name: t.embed.fields.createdAt,
          value: `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:R>`,
          inline: true,
        },
        {
          name: "📊 最活躍的伺服器",
          value: topGuildsContent,
          inline: false,
        },
        {
          name: "🚀 最常用指令",
          value: topCommandsContent,
          inline: false,
        },
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
      )
      .setTimestamp();

    await interaction.reply({
      embeds: [embed],
      flags: MessageFlags.Ephemeral,
    });
  },
};
