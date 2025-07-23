import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Locale,
  EmbedBuilder,
  PermissionsBitField,
  MessageFlags,
} from "discord.js";
import { Command } from "../../../interfaces/Command";
import { getLocalizations } from "../../../utils/localization";
import {
  getUserTopActiveGuilds,
  getUserTopCommands,
  getUserRecentTransactions,
  getUserTotalCardCount,
} from "../../../shared/database/queries";
import { gachaPool } from "../../../shared/database";

const translations = getLocalizations("userinfo");

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("user-info")
    .setDescription(translations["en-US"].description)
    .setNameLocalizations({
      [Locale.EnglishUS]: "user-info",
      [Locale.ChineseTW]: "使用者資訊",
    })
    .setDescriptionLocalizations({
      [Locale.EnglishUS]: translations["en-US"].description,
      [Locale.ChineseTW]: translations["zh-TW"].description,
    })
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to get information about.")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
  guildOnly: true,
  async execute(interaction: ChatInputCommandInteraction) {
    const t = translations[interaction.locale] ?? translations["en-US"];
    const targetUser = interaction.options.getUser("user") ?? interaction.user;

    const [topGuilds, topCommands, recentTransactions, totalCards] =
      await Promise.all([
        getUserTopActiveGuilds(gachaPool, targetUser.id),
        getUserTopCommands(gachaPool, targetUser.id),
        getUserRecentTransactions(gachaPool, targetUser.id),
        getUserTotalCardCount(gachaPool, targetUser.id),
      ]);

    const topGuildsContent =
      topGuilds.length > 0
        ? topGuilds
            .map((g, i) => {
              const guild = interaction.client.guilds.cache.get(g.guild_id);
              return `${i + 1}. ${
                guild ? `${guild.id} ${guild.name}` : g.guild_id
              } - (${g.usage_count} 次)`;
            })
            .join("\n")
        : "無紀錄";

    const topCommandsContent =
      topCommands.length > 0
        ? topCommands
            .map(
              (c, i) => `${i + 1}. ${c.command_name} - (${c.usage_count} 次)`
            )
            .join("\n")
        : "無紀錄";

    const recentTransactionsContent =
      recentTransactions.length > 0
        ? recentTransactions
            .map((tx) => {
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
          value: `總持有卡片數量： ${totalCards} 張`,
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
