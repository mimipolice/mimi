/**
 * UI 組件建構器
 * 負責創建 Select Menu、Button 和 Container
 */

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
} from "discord.js";
import type { RelationshipNetwork } from "./relationship-analyzer";

export interface UIState {
  currentView: string;
  interactionSortBy: "count" | "amount";
  relationshipSubView: "overview" | "pagerank" | "communities" | "cycles" | "clusters" | "connections";
  expandedCommunities: Set<number>;
  transactionPage: number;
  relationshipNetwork?: RelationshipNetwork;
  recentTransactionsLength: number;
}

/**
 * 創建主選單
 */
export function createSelectMenu(state: UIState) {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("view_selector")
      .setPlaceholder("選擇要查看的資訊類別")
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel("📊 綜合資訊")
          .setDescription("查看使用者的基本資訊和活動統計")
          .setValue("general")
          .setEmoji("📊")
          .setDefault(state.currentView === "general"),
        new StringSelectMenuOptionBuilder()
          .setLabel("💰 財務總覽")
          .setDescription("查看帳戶餘額、交易統計和投資組合")
          .setValue("financial")
          .setEmoji("💰")
          .setDefault(state.currentView === "financial"),
        new StringSelectMenuOptionBuilder()
          .setLabel("🤝 互動排行")
          .setDescription("查看最常互動的使用者")
          .setValue("interactions")
          .setEmoji("🤝")
          .setDefault(state.currentView === "interactions"),
        new StringSelectMenuOptionBuilder()
          .setLabel("🔍 使用模式分析")
          .setDescription("分析指令使用模式，檢測異常行為")
          .setValue("usage_pattern")
          .setEmoji("🔍")
          .setDefault(state.currentView === "usage_pattern"),
        new StringSelectMenuOptionBuilder()
          .setLabel("🕸️ 關係網路分析")
          .setDescription("分析帳號關聯性，檢測小帳集團")
          .setValue("relationship")
          .setEmoji("🕸️")
          .setDefault(state.currentView === "relationship"),
        new StringSelectMenuOptionBuilder()
          .setLabel("📝 詳細記錄")
          .setDescription("查看交易記錄和卡片收藏")
          .setValue("details")
          .setEmoji("📝")
          .setDefault(state.currentView === "details")
      )
  );
}

/**
 * 創建關係網路子選單
 */
export function createRelationshipSubMenu(state: UIState) {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("relationship_sub_selector")
      .setPlaceholder("選擇關係網路分析項目")
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel("📊 總覽")
          .setDescription("查看網路統計和整體概況")
          .setValue("overview")
          .setEmoji("📊")
          .setDefault(state.relationshipSubView === "overview"),
        new StringSelectMenuOptionBuilder()
          .setLabel("👑 關鍵節點 (PageRank)")
          .setDescription("查看網路中最重要的帳號")
          .setValue("pagerank")
          .setEmoji("👑")
          .setDefault(state.relationshipSubView === "pagerank"),
        new StringSelectMenuOptionBuilder()
          .setLabel("🏘️ 社群檢測")
          .setDescription("查看自動發現的緊密群組")
          .setValue("communities")
          .setEmoji("🏘️")
          .setDefault(state.relationshipSubView === "communities"),
        new StringSelectMenuOptionBuilder()
          .setLabel("🔄 循環交易")
          .setDescription("查看可疑的循環交易模式")
          .setValue("cycles")
          .setEmoji("🔄")
          .setDefault(state.relationshipSubView === "cycles"),
        new StringSelectMenuOptionBuilder()
          .setLabel("🚨 可疑集群")
          .setDescription("查看基於規則檢測的可疑集群")
          .setValue("clusters")
          .setEmoji("🚨")
          .setDefault(state.relationshipSubView === "clusters"),
        new StringSelectMenuOptionBuilder()
          .setLabel("🔗 直接/間接關係")
          .setDescription("查看詳細的關係列表")
          .setValue("connections")
          .setEmoji("🔗")
          .setDefault(state.relationshipSubView === "connections")
      )
  );
}

/**
 * 創建操作按鈕
 */
export function createActionButtons(state: UIState) {
  const buttons = [
    new ButtonBuilder()
      .setCustomId("refresh_data")
      .setLabel("🔄 重新整理")
      .setStyle(ButtonStyle.Secondary),
  ];

  // 互動排行頁面顯示排序按鈕
  if (state.currentView === "interactions") {
    buttons.push(
      new ButtonBuilder()
        .setCustomId("sort_by_amount")
        .setLabel("💰 按金額排序")
        .setStyle(
          state.interactionSortBy === "amount"
            ? ButtonStyle.Primary
            : ButtonStyle.Secondary
        )
        .setDisabled(state.interactionSortBy === "amount"),
      new ButtonBuilder()
        .setCustomId("sort_by_count")
        .setLabel("🔢 按次數排序")
        .setStyle(
          state.interactionSortBy === "count"
            ? ButtonStyle.Primary
            : ButtonStyle.Secondary
        )
        .setDisabled(state.interactionSortBy === "count")
    );
  }

  // 關係網路 - 社群檢測頁面顯示展開按鈕
  if (
    state.currentView === "relationship" &&
    state.relationshipSubView === "communities" &&
    state.relationshipNetwork?.communities
  ) {
    state.relationshipNetwork.communities.slice(0, 3).forEach((community, i) => {
      if (community.members.length > 10 && buttons.length < 5) {
        const isExpanded = state.expandedCommunities.has(i);
        buttons.push(
          new ButtonBuilder()
            .setCustomId(`expand_community_${i}`)
            .setLabel(`${isExpanded ? "收起" : "展開"}社群 ${i + 1}`)
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(isExpanded ? "▲" : "▼")
        );
      }
    });
  }

  // 詳細記錄頁面顯示翻頁按鈕
  if (state.currentView === "details") {
    const totalPages = Math.ceil(state.recentTransactionsLength / 5);
    if (totalPages > 1) {
      if (state.transactionPage > 0) {
        buttons.push(
          new ButtonBuilder()
            .setCustomId("transaction_prev")
            .setLabel("◀ 上一頁")
            .setStyle(ButtonStyle.Secondary)
        );
      }
      if (state.transactionPage < totalPages - 1) {
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
}

/**
 * 創建 Container
 */
export function createContainer(
  content: string,
  state: UIState
) {
  const container = new ContainerBuilder()
    .setAccentColor(0x5865f2)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(content))
    .addActionRowComponents(createSelectMenu(state));

  // 如果在關係網路分析頁面，添加子選單
  if (state.currentView === "relationship" && state.relationshipNetwork) {
    container.addActionRowComponents(createRelationshipSubMenu(state));
  }

  container.addActionRowComponents(createActionButtons(state));

  return container;
}
