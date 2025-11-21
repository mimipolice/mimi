import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Locale,
  PermissionsBitField,
  MessageFlags,
  DiscordAPIError,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
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
import { Services } from "../../../interfaces/Command";
import {
  createGeneralContent,
  createFinancialContent,
  createInteractionsContent,
  createUsagePatternContent,
  createRelationshipContent,
  createDetailsContent,
} from "./content-generators";
import { analyzeUserRelationships } from "./relationship-analyzer";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("user-info")
    .setDescription("Get information about a user.")
    .setNameLocalizations({
      [Locale.EnglishUS]: "user-info",
      [Locale.ChineseTW]: "使用者資訊",
    })
    .setDescriptionLocalizations({
      [Locale.EnglishUS]: "Get information about a user.",
      [Locale.ChineseTW]: "取得使用者資訊。",
    })
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to get information about.")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
  guildOnly: true,
  async execute(
    interaction: ChatInputCommandInteraction,
    client,
    services: Services
  ) {
    const { localizationManager } = services;
    const translations = getLocalizations(localizationManager, "userinfo");
    const t = translations[interaction.locale] ?? translations["en-US"];
    const targetUser = interaction.options.getUser("user") ?? interaction.user;

    // Check if interaction hasn't been deferred/replied to (important for retry logic)
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }

    // 並行獲取所有資料
    const [userInfo, usagePatterns, recentFrequency, recentTransactions] =
      await Promise.all([
        getUserInfoData(targetUser.id),
        getCommandUsagePatterns(targetUser.id),
        getCommandUsageFrequency(targetUser.id, 60),
        getRecentTransactions(targetUser.id, 0, 15),
      ]);

    // 關係網路分析（延遲載入）
    let relationshipNetwork: Awaited<
      ReturnType<typeof analyzeUserRelationships>
    > | undefined = undefined;

    // 狀態管理
    let currentView = "general";
    let interactionSortBy: "count" | "amount" = "amount";
    let relationshipSubView: "overview" | "pagerank" | "communities" | "cycles" | "clusters" | "connections" | "guilds" = "overview";
    let expandedCommunities = new Set<number>(); // 追蹤哪些社群被展開
    let transactionPage = 0; // 交易記錄頁碼

    const contentOptions: any = {
      targetUser,
      userInfo,
      usagePatterns,
      recentFrequency,
      recentTransactions,
      relationshipNetwork,
      client,
      interactionSortBy,
      relationshipSubView,
      expandedCommunities,
      transactionPage,
    };

    const contentMap: { [key: string]: () => string } = {
      general: () => createGeneralContent(contentOptions),
      financial: () => createFinancialContent(contentOptions),
      interactions: () => createInteractionsContent(contentOptions),
      usage_pattern: () => createUsagePatternContent(contentOptions),
      relationship: () => createRelationshipContent(contentOptions),
      details: () => createDetailsContent(contentOptions),
    };

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
              .setLabel("關係網路分析")
              .setDescription("分析帳號關聯性，檢測小帳集團")
              .setValue("relationship")
              .setEmoji("🕸️")
              .setDefault(currentView === "relationship"),
            new StringSelectMenuOptionBuilder()
              .setLabel("詳細記錄")
              .setDescription("查看交易記錄和卡片收藏")
              .setValue("details")
              .setEmoji("📝")
              .setDefault(currentView === "details")
          )
      );
    };

    const createRelationshipSubMenu = () => {
      return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("relationship_sub_selector")
          .setPlaceholder("選擇關係網路分析項目")
          .addOptions(
            new StringSelectMenuOptionBuilder()
              .setLabel("總覽")
              .setDescription("查看網路統計和整體概況")
              .setValue("overview")
              .setEmoji("📊")
              .setDefault(relationshipSubView === "overview"),
            new StringSelectMenuOptionBuilder()
              .setLabel("關鍵節點 (PageRank)")
              .setDescription("查看網路中最重要的帳號")
              .setValue("pagerank")
              .setEmoji("👑")
              .setDefault(relationshipSubView === "pagerank"),
            new StringSelectMenuOptionBuilder()
              .setLabel("社群檢測")
              .setDescription("查看自動發現的緊密群組")
              .setValue("communities")
              .setEmoji("🏘️")
              .setDefault(relationshipSubView === "communities"),
            new StringSelectMenuOptionBuilder()
              .setLabel("循環交易")
              .setDescription("查看可疑的循環交易模式")
              .setValue("cycles")
              .setEmoji("🔄")
              .setDefault(relationshipSubView === "cycles"),
            new StringSelectMenuOptionBuilder()
              .setLabel("可疑集群")
              .setDescription("查看基於規則檢測的可疑集群")
              .setValue("clusters")
              .setEmoji("🚨")
              .setDefault(relationshipSubView === "clusters"),
            new StringSelectMenuOptionBuilder()
              .setLabel("直接/間接關係")
              .setDescription("查看詳細的關係列表")
              .setValue("connections")
              .setEmoji("🔗")
              .setDefault(relationshipSubView === "connections")
          )
      );
    };

    const createActionButtons = () => {
      const buttons = [
        new ButtonBuilder()
          .setCustomId("refresh_data")
          .setLabel("🔄 重新整理")
          .setStyle(ButtonStyle.Secondary),
      ];

      // 互動排行頁面顯示排序按鈕
      if (currentView === "interactions") {
        buttons.push(
          new ButtonBuilder()
            .setCustomId("sort_by_amount")
            .setLabel("💰 按金額排序")
            .setStyle(
              interactionSortBy === "amount"
                ? ButtonStyle.Primary
                : ButtonStyle.Secondary
            )
            .setDisabled(interactionSortBy === "amount"),
          new ButtonBuilder()
            .setCustomId("sort_by_count")
            .setLabel("🔢 按次數排序")
            .setStyle(
              interactionSortBy === "count"
                ? ButtonStyle.Primary
                : ButtonStyle.Secondary
            )
            .setDisabled(interactionSortBy === "count")
        );
      }

      // 關係網路 - 社群檢測頁面顯示展開按鈕
      if (currentView === "relationship" && relationshipSubView === "communities" && relationshipNetwork?.communities) {
        relationshipNetwork.communities.slice(0, 3).forEach((community, i) => {
          if (community.members.length > 10 && buttons.length < 5) {
            const isExpanded = expandedCommunities.has(i);
            buttons.push(
              new ButtonBuilder()
                .setCustomId(`expand_community_${i}`)
                .setLabel(`${isExpanded ? "收起" : "展開"}社群 ${i + 1}`)
                .setStyle(ButtonStyle.Secondary)
            );
          }
        });
      }

      // 詳細記錄頁面顯示翻頁按鈕
      if (currentView === "details") {
        const totalPages = Math.ceil(recentTransactions.length / 5);
        if (totalPages > 1) {
          if (transactionPage > 0) {
            buttons.push(
              new ButtonBuilder()
                .setCustomId("transaction_prev")
                .setLabel("◀ 上一頁")
                .setStyle(ButtonStyle.Secondary)
            );
          }
          if (transactionPage < totalPages - 1) {
            buttons.push(
              new ButtonBuilder()
                .setCustomId("transaction_next")
                .setLabel("下一頁 ▶")
                .setStyle(ButtonStyle.Secondary)
            );
          }
        }
      }

      return new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);
    };

    const createContainer = () => {
      const container = new ContainerBuilder()
        .setAccentColor(0x5865f2)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(contentMap[currentView]())
        )
        .addActionRowComponents(createSelectMenu());
      
      // 如果在關係網路分析頁面，添加子選單
      if (currentView === "relationship" && relationshipNetwork) {
        container.addActionRowComponents(createRelationshipSubMenu());
      }
      
      container.addActionRowComponents(createActionButtons());
      
      return container;
    };

    const message = await interaction.editReply({
      content: null,
      embeds: [],
      components: [createContainer()],
      flags: [MessageFlags.IsComponentsV2],
    });

    const collector = message.createMessageComponentCollector({
      time: 600000, // 10 minutes
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
          const newView = i.values[0];
          currentView = newView;

          // 如果切換到關係網路分析且尚未載入，則載入資料
          if (newView === "relationship" && !relationshipNetwork) {
            await i.deferUpdate();
            relationshipNetwork = await analyzeUserRelationships(
              targetUser.id,
              userInfo.top_guilds
            );
            contentOptions.relationshipNetwork = relationshipNetwork;
            await i.editReply({
              content: null,
              embeds: [],
              components: [createContainer()],
              flags: [MessageFlags.IsComponentsV2],
            });
          } else {
            await i.update({
              content: null,
              embeds: [],
              components: [createContainer()],
              flags: [MessageFlags.IsComponentsV2],
            });
          }
        } else if (i.isStringSelectMenu() && i.customId === "relationship_sub_selector") {
          const newSubView = i.values[0] as typeof relationshipSubView;
          relationshipSubView = newSubView;
          contentOptions.relationshipSubView = newSubView;
          await i.update({
            content: null,
            embeds: [],
            components: [createContainer()],
            flags: [MessageFlags.IsComponentsV2],
          });
        } else if (i.isButton()) {
          if (i.customId === "refresh_data") {
            await i.deferUpdate();
            // 重新獲取資料
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

            // 如果在關係網路頁面，也重新載入
            if (currentView === "relationship") {
              relationshipNetwork = await analyzeUserRelationships(
                targetUser.id,
                userInfo.top_guilds
              );
              contentOptions.relationshipNetwork = relationshipNetwork;
            }

            await i.editReply({
              content: null,
              embeds: [],
              components: [createContainer()],
              flags: [MessageFlags.IsComponentsV2],
            });
          } else if (i.customId === "sort_by_amount") {
            interactionSortBy = "amount";
            contentOptions.interactionSortBy = "amount";
            await i.update({
              content: null,
              embeds: [],
              components: [createContainer()],
              flags: [MessageFlags.IsComponentsV2],
            });
          } else if (i.customId === "sort_by_count") {
            interactionSortBy = "count" as const;
            contentOptions.interactionSortBy = "count" as const;
            await i.update({
              content: null,
              embeds: [],
              components: [createContainer()],
              flags: [MessageFlags.IsComponentsV2],
            });
          } else if (i.customId.startsWith("expand_community_")) {
            const communityIndex = parseInt(i.customId.split("_")[2]);
            if (expandedCommunities.has(communityIndex)) {
              expandedCommunities.delete(communityIndex);
            } else {
              expandedCommunities.add(communityIndex);
            }
            contentOptions.expandedCommunities = expandedCommunities;
            await i.update({
              content: null,
              embeds: [],
              components: [createContainer()],
              flags: [MessageFlags.IsComponentsV2],
            });
          } else if (i.customId === "transaction_prev") {
            transactionPage = Math.max(0, transactionPage - 1);
            contentOptions.transactionPage = transactionPage;
            await i.update({
              content: null,
              embeds: [],
              components: [createContainer()],
              flags: [MessageFlags.IsComponentsV2],
            });
          } else if (i.customId === "transaction_next") {
            const totalPages = Math.ceil(recentTransactions.length / 5);
            transactionPage = Math.min(totalPages - 1, transactionPage + 1);
            contentOptions.transactionPage = transactionPage;
            await i.update({
              content: null,
              embeds: [],
              components: [createContainer()],
              flags: [MessageFlags.IsComponentsV2],
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
