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
  getTimePeriodFinancials,
  getAnomalyData,
  getServerActivityTrends,
  getCommandUsageByType,
} from "../../../repositories/user.repository";
import { Services } from "../../../interfaces/Command";
import {
  createGeneralContent,
  createFinancialContent,
  createInteractionsContent,
  createUsagePatternContent,
  createRelationshipContent,
  createDetailsContent,
} from "./content-generators/index";
import { analyzeUserRelationships } from "./relationship-analyzer";
import { CacheService } from "../../../services/CacheService";
import { analyzeCommandTypes } from "./financial-analyzer";

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

    // 初始化快取服務
    const cacheService = CacheService.getInstance();
    
    // Cache TTL constants (in seconds)
    const CACHE_TTL = {
      financials: 300,    // 5 minutes
      anomaly: 60,        // 1 minute
      activity: 300,      // 5 minutes
      commands: 600,      // 10 minutes
    };

    // 關係網路分析（延遲載入）
    let relationshipNetwork: Awaited<
      ReturnType<typeof analyzeUserRelationships>
    > | undefined = undefined;

    // 財務資料（延遲載入）
    let timePeriodFinancials: Awaited<
      ReturnType<typeof getTimePeriodFinancials>
    > | undefined = undefined;

    // 異常活動資料（延遲載入）
    let anomalyData: Awaited<
      ReturnType<typeof getAnomalyData>
    > | undefined = undefined;

    // 伺服器活動趨勢（延遲載入）
    let serverActivityTrends: Awaited<
      ReturnType<typeof getServerActivityTrends>
    > | undefined = undefined;

    // 指令類型分析（延遲載入）
    let commandTypeAnalysis: Awaited<
      ReturnType<typeof analyzeCommandTypes>
    > | undefined = undefined;

    // 狀態管理
    let currentView = "general";
    let interactionSortBy: "count" | "amount" = "amount";
    let relationshipSubView: "overview" | "pagerank" | "communities" | "cycles" | "clusters" | "connections" | "guilds" = "overview";
    let financialSubView: "overview" | "time_period" | "anomaly" | "income" | "expense" | "portfolio" = "overview" as "overview" | "time_period" | "anomaly" | "income" | "expense" | "portfolio";
    let anomalySubView: "overview" | "abnormal_income" | "abnormal_expense" | "high_frequency" | "large_transactions" | "time_comparison" = "overview" as "overview" | "abnormal_income" | "abnormal_expense" | "high_frequency" | "large_transactions" | "time_comparison";
    let expandedCommunities = new Set<number>(); // 追蹤哪些社群被展開
    let transactionPage = 0; // 交易記錄頁碼

    // Lazy loading helper functions with caching
    const loadTimePeriodFinancials = async () => {
      if (timePeriodFinancials) return timePeriodFinancials;
      
      const cacheKey = `user-info:financials:${targetUser.id}`;
      const cached = await cacheService.get<Awaited<ReturnType<typeof getTimePeriodFinancials>>>(cacheKey);
      
      if (cached) {
        timePeriodFinancials = cached;
        return cached;
      }
      
      timePeriodFinancials = await getTimePeriodFinancials(targetUser.id);
      await cacheService.set(cacheKey, timePeriodFinancials, CACHE_TTL.financials);
      return timePeriodFinancials;
    };

    const loadAnomalyData = async () => {
      if (anomalyData) return anomalyData;
      
      const cacheKey = `user-info:anomaly:${targetUser.id}`;
      const cached = await cacheService.get<Awaited<ReturnType<typeof getAnomalyData>>>(cacheKey);
      
      if (cached) {
        anomalyData = cached;
        return cached;
      }
      
      anomalyData = await getAnomalyData(targetUser.id, 24);
      await cacheService.set(cacheKey, anomalyData, CACHE_TTL.anomaly);
      return anomalyData;
    };

    const loadServerActivityTrends = async () => {
      if (serverActivityTrends) return serverActivityTrends;
      
      const cacheKey = `user-info:activity:${targetUser.id}`;
      const cached = await cacheService.get<Awaited<ReturnType<typeof getServerActivityTrends>>>(cacheKey);
      
      if (cached) {
        serverActivityTrends = cached;
        return cached;
      }
      
      serverActivityTrends = await getServerActivityTrends(targetUser.id);
      await cacheService.set(cacheKey, serverActivityTrends, CACHE_TTL.activity);
      return serverActivityTrends;
    };

    const loadCommandTypeAnalysis = async () => {
      if (commandTypeAnalysis) return commandTypeAnalysis;
      
      const cacheKey = `user-info:commands:${targetUser.id}`;
      const cached = await cacheService.get<Awaited<ReturnType<typeof analyzeCommandTypes>>>(cacheKey);
      
      if (cached) {
        commandTypeAnalysis = cached;
        return cached;
      }
      
      const commandUsage = await getCommandUsageByType(targetUser.id);
      // Map CommandUsageByType to CommandUsage format
      const mappedCommands = commandUsage.map(cmd => ({
        commandName: cmd.commandName,
        count: cmd.usageCount
      }));
      commandTypeAnalysis = analyzeCommandTypes(mappedCommands);
      await cacheService.set(cacheKey, commandTypeAnalysis, CACHE_TTL.commands);
      return commandTypeAnalysis;
    };

    const contentOptions: any = {
      targetUser,
      userInfo,
      usagePatterns,
      recentFrequency,
      recentTransactions,
      relationshipNetwork,
      timePeriodFinancials,
      anomalyData,
      serverActivityTrends,
      commandTypeAnalysis,
      client,
      interactionSortBy,
      relationshipSubView,
      financialSubView,
      anomalySubView,
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

    const createFinancialSubMenu = () => {
      return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("financial_sub_selector")
          .setPlaceholder("選擇財務分析項目")
          .addOptions(
            new StringSelectMenuOptionBuilder()
              .setLabel("總覽")
              .setDescription("查看帳戶餘額、總收支和異常警報摘要")
              .setValue("overview")
              .setEmoji("📊")
              .setDefault(financialSubView === "overview"),
            new StringSelectMenuOptionBuilder()
              .setLabel("時間段分析")
              .setDescription("查看今日、本週、本月的淨利對比")
              .setValue("time_period")
              .setEmoji("💹")
              .setDefault(financialSubView === "time_period"),
            new StringSelectMenuOptionBuilder()
              .setLabel("異常活動檢測")
              .setDescription("檢測短期內的異常財務活動")
              .setValue("anomaly")
              .setEmoji("🚨")
              .setDefault(financialSubView === "anomaly"),
            new StringSelectMenuOptionBuilder()
              .setLabel("收入分析")
              .setDescription("查看收入來源的詳細分類")
              .setValue("income")
              .setEmoji("📈")
              .setDefault(financialSubView === "income"),
            new StringSelectMenuOptionBuilder()
              .setLabel("支出分析")
              .setDescription("查看支出項目的詳細分類")
              .setValue("expense")
              .setEmoji("📉")
              .setDefault(financialSubView === "expense"),
            new StringSelectMenuOptionBuilder()
              .setLabel("投資組合")
              .setDescription("查看股票持倉和市值分析")
              .setValue("portfolio")
              .setEmoji("💼")
              .setDefault(financialSubView === "portfolio")
          )
      );
    };

    const createAnomalySubMenu = () => {
      return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("anomaly_sub_selector")
          .setPlaceholder("選擇異常活動分析項目")
          .addOptions(
            new StringSelectMenuOptionBuilder()
              .setLabel("總覽")
              .setDescription("查看風險評分和警報摘要")
              .setValue("overview")
              .setEmoji("📊")
              .setDefault(anomalySubView === "overview"),
            new StringSelectMenuOptionBuilder()
              .setLabel("異常收入")
              .setDescription("查看異常收入來源的詳細分析")
              .setValue("abnormal_income")
              .setEmoji("💰")
              .setDefault(anomalySubView === "abnormal_income"),
            new StringSelectMenuOptionBuilder()
              .setLabel("異常支出")
              .setDescription("查看異常支出對象的詳細分析")
              .setValue("abnormal_expense")
              .setEmoji("💸")
              .setDefault(anomalySubView === "abnormal_expense"),
            new StringSelectMenuOptionBuilder()
              .setLabel("高頻交易")
              .setDescription("查看交易頻率和對象分布")
              .setValue("high_frequency")
              .setEmoji("⚡")
              .setDefault(anomalySubView === "high_frequency"),
            new StringSelectMenuOptionBuilder()
              .setLabel("大額交易")
              .setDescription("查看所有大額交易列表")
              .setValue("large_transactions")
              .setEmoji("💎")
              .setDefault(anomalySubView === "large_transactions"),
            new StringSelectMenuOptionBuilder()
              .setLabel("時間對比")
              .setDescription("查看 24h、7d、30d 的詳細對比")
              .setValue("time_comparison")
              .setEmoji("📊")
              .setDefault(anomalySubView === "time_comparison")
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
      
      // 如果在財務總覽頁面，添加財務子選單
      if (currentView === "financial") {
        container.addActionRowComponents(createFinancialSubMenu());
        
        // 如果在異常活動檢測子頁面，添加異常活動子選單
        if (financialSubView === "anomaly") {
          container.addActionRowComponents(createAnomalySubMenu());
        }
      }
      
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
          const previousView = currentView;
          currentView = newView;

          // Reset sub-menu states when switching away from their parent views
          if (previousView === "financial" && newView !== "financial") {
            financialSubView = "overview";
            anomalySubView = "overview";
            contentOptions.financialSubView = "overview";
            contentOptions.anomalySubView = "overview";
          }

          // Lazy load data based on view
          let needsDefer = false;
          
          // 如果切換到關係網路分析且尚未載入，則載入資料
          if (newView === "relationship" && !relationshipNetwork) {
            needsDefer = true;
          }
          
          // 如果切換到財務總覽且尚未載入，則載入資料
          if (newView === "financial" && !timePeriodFinancials) {
            needsDefer = true;
          }
          
          // 如果切換到綜合資訊且尚未載入活動趨勢，則載入資料
          if (newView === "general" && !serverActivityTrends) {
            needsDefer = true;
          }
          
          // 如果切換到使用模式分析且尚未載入指令類型，則載入資料
          if (newView === "usage_pattern" && !commandTypeAnalysis) {
            needsDefer = true;
          }

          if (needsDefer) {
            await i.deferUpdate();
            
            // Load data based on view
            if (newView === "relationship" && !relationshipNetwork) {
              relationshipNetwork = await analyzeUserRelationships(
                targetUser.id,
                userInfo.top_guilds
              );
              contentOptions.relationshipNetwork = relationshipNetwork;
            }
            
            if (newView === "financial" && !timePeriodFinancials) {
              timePeriodFinancials = await loadTimePeriodFinancials();
              contentOptions.timePeriodFinancials = timePeriodFinancials;
            }
            
            if (newView === "general" && !serverActivityTrends) {
              serverActivityTrends = await loadServerActivityTrends();
              contentOptions.serverActivityTrends = serverActivityTrends;
            }
            
            if (newView === "usage_pattern" && !commandTypeAnalysis) {
              commandTypeAnalysis = await loadCommandTypeAnalysis();
              contentOptions.commandTypeAnalysis = commandTypeAnalysis;
            }
            
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
        } else if (i.isStringSelectMenu() && i.customId === "financial_sub_selector") {
          const newSubView = i.values[0] as typeof financialSubView;
          financialSubView = newSubView;
          contentOptions.financialSubView = newSubView;
          
          // Reset anomaly sub-view when switching away from anomaly
          if (newSubView !== "anomaly") {
            anomalySubView = "overview";
            contentOptions.anomalySubView = "overview";
          }
          
          // Lazy load financial data if needed
          let needsDefer = false;
          
          if ((newSubView === "time_period" || newSubView === "overview") && !timePeriodFinancials) {
            needsDefer = true;
          }
          
          if (newSubView === "anomaly" && !anomalyData) {
            needsDefer = true;
          }
          
          if (needsDefer) {
            await i.deferUpdate();
            
            if ((newSubView === "time_period" || newSubView === "overview") && !timePeriodFinancials) {
              timePeriodFinancials = await loadTimePeriodFinancials();
              contentOptions.timePeriodFinancials = timePeriodFinancials;
            }
            
            if (newSubView === "anomaly" && !anomalyData) {
              anomalyData = await loadAnomalyData();
              contentOptions.anomalyData = anomalyData;
            }
            
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
        } else if (i.isStringSelectMenu() && i.customId === "anomaly_sub_selector") {
          const newSubView = i.values[0] as typeof anomalySubView;
          anomalySubView = newSubView;
          contentOptions.anomalySubView = newSubView;
          
          // Ensure anomaly data is loaded
          if (!anomalyData) {
            await i.deferUpdate();
            anomalyData = await loadAnomalyData();
            contentOptions.anomalyData = anomalyData;
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
