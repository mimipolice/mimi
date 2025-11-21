/**
 * 互動處理器
 * 負責處理按鈕點擊和選單選擇
 */

import type { MessageComponentInteraction, User } from "discord.js";
import { MessageFlags } from "discord.js";
import type { UIState } from "./ui-builders";
import { createContainer } from "./ui-builders";
import { analyzeUserRelationships } from "./relationship-analyzer";
import {
  getUserInfoData,
  getCommandUsagePatterns,
  getCommandUsageFrequency,
} from "../../../repositories/user.repository";

export interface InteractionHandlerContext {
  state: UIState;
  contentMap: { [key: string]: () => string };
  contentOptions: any;
  targetUser: User;
  userInfo: any;
  usagePatterns: any[];
  recentFrequency: any[];
}

/**
 * 處理主視圖選擇
 */
export async function handleViewSelector(
  interaction: MessageComponentInteraction,
  context: InteractionHandlerContext
) {
  if (!interaction.isStringSelectMenu()) return;

  const newView = interaction.values[0];
  context.state.currentView = newView;

  // 如果切換到關係網路分析且尚未載入，則載入資料
  if (newView === "relationship" && !context.state.relationshipNetwork) {
    await interaction.deferUpdate();
    context.state.relationshipNetwork = await analyzeUserRelationships(
      context.targetUser.id
    );
    context.contentOptions.relationshipNetwork =
      context.state.relationshipNetwork;
    await interaction.editReply({
      content: null,
      embeds: [],
      components: [
        createContainer(context.contentMap[newView](), context.state),
      ],
      flags: [MessageFlags.IsComponentsV2],
    });
  } else {
    await interaction.update({
      content: null,
      embeds: [],
      components: [
        createContainer(context.contentMap[newView](), context.state),
      ],
      flags: [MessageFlags.IsComponentsV2],
    });
  }
}

/**
 * 處理關係網路子視圖選擇
 */
export async function handleRelationshipSubSelector(
  interaction: MessageComponentInteraction,
  context: InteractionHandlerContext
) {
  if (!interaction.isStringSelectMenu()) return;

  const newSubView = interaction.values[0] as typeof context.state.relationshipSubView;
  context.state.relationshipSubView = newSubView;
  context.contentOptions.relationshipSubView = newSubView;

  await interaction.update({
    content: null,
    embeds: [],
    components: [
      createContainer(
        context.contentMap[context.state.currentView](),
        context.state
      ),
    ],
    flags: [MessageFlags.IsComponentsV2],
  });
}

/**
 * 處理刷新數據
 */
export async function handleRefreshData(
  interaction: MessageComponentInteraction,
  context: InteractionHandlerContext
) {
  await interaction.deferUpdate();

  // 重新獲取資料
  const [newUserInfo, newUsagePatterns, newRecentFrequency] =
    await Promise.all([
      getUserInfoData(context.targetUser.id),
      getCommandUsagePatterns(context.targetUser.id),
      getCommandUsageFrequency(context.targetUser.id, 60),
    ]);

  Object.assign(context.userInfo, newUserInfo);
  context.usagePatterns.length = 0;
  context.usagePatterns.push(...newUsagePatterns);
  context.recentFrequency.length = 0;
  context.recentFrequency.push(...newRecentFrequency);

  // 如果在關係網路頁面，也重新載入
  if (context.state.currentView === "relationship") {
    context.state.relationshipNetwork = await analyzeUserRelationships(
      context.targetUser.id
    );
    context.contentOptions.relationshipNetwork =
      context.state.relationshipNetwork;
  }

  await interaction.editReply({
    content: null,
    embeds: [],
    components: [
      createContainer(
        context.contentMap[context.state.currentView](),
        context.state
      ),
    ],
    flags: [MessageFlags.IsComponentsV2],
  });
}

/**
 * 處理排序切換
 */
export async function handleSortToggle(
  interaction: MessageComponentInteraction,
  context: InteractionHandlerContext,
  sortBy: "amount" | "count"
) {
  context.state.interactionSortBy = sortBy;
  context.contentOptions.interactionSortBy = sortBy;

  await interaction.update({
    content: null,
    embeds: [],
    components: [
      createContainer(
        context.contentMap[context.state.currentView](),
        context.state
      ),
    ],
    flags: [MessageFlags.IsComponentsV2],
  });
}

/**
 * 處理社群展開/收起
 */
export async function handleCommunityExpand(
  interaction: MessageComponentInteraction,
  context: InteractionHandlerContext,
  communityIndex: number
) {
  if (context.state.expandedCommunities.has(communityIndex)) {
    context.state.expandedCommunities.delete(communityIndex);
  } else {
    context.state.expandedCommunities.add(communityIndex);
  }
  context.contentOptions.expandedCommunities = context.state.expandedCommunities;

  await interaction.update({
    content: null,
    embeds: [],
    components: [
      createContainer(
        context.contentMap[context.state.currentView](),
        context.state
      ),
    ],
    flags: [MessageFlags.IsComponentsV2],
  });
}

/**
 * 處理交易記錄翻頁
 */
export async function handleTransactionPagination(
  interaction: MessageComponentInteraction,
  context: InteractionHandlerContext,
  direction: "prev" | "next"
) {
  const totalPages = Math.ceil(context.state.recentTransactionsLength / 5);

  if (direction === "prev") {
    context.state.transactionPage = Math.max(0, context.state.transactionPage - 1);
  } else {
    context.state.transactionPage = Math.min(
      totalPages - 1,
      context.state.transactionPage + 1
    );
  }

  context.contentOptions.transactionPage = context.state.transactionPage;

  await interaction.update({
    content: null,
    embeds: [],
    components: [
      createContainer(
        context.contentMap[context.state.currentView](),
        context.state
      ),
    ],
    flags: [MessageFlags.IsComponentsV2],
  });
}
