/**
 * Shared types for content generators
 * 
 * This module contains type definitions and interfaces used across
 * all content generator modules.
 * 
 * Requirements: 1.1, 1.2, 3.1, 3.3, 4.1, 4.4
 */

import { User, Client } from "discord.js";
import {
  UserInfoData,
  CommandUsagePattern,
  AnomalyData as AnomalyDataDB,
} from "../../../../shared/database/types";
import { RelationshipNetwork } from "../relationship-analyzer";
import { TimePeriodFinancials } from "../formatters";
import { CommandTypeAnalysis } from "../financial-analyzer";

/**
 * Options interface for content generator functions
 * 
 * This interface defines all possible parameters that can be passed
 * to content generation functions. Not all fields are required for
 * every generator.
 */
export interface ContentGeneratorOptions {
  targetUser: User;
  userInfo: UserInfoData;
  usagePatterns: CommandUsagePattern[];
  recentFrequency: { command_name: string; usage_count: number }[];
  recentTransactions: any[];
  relationshipNetwork?: RelationshipNetwork;
  client: Client;
  interactionSortBy?: "count" | "amount";
  relationshipSubView?: "overview" | "pagerank" | "communities" | "cycles" | "clusters" | "connections" | "guilds";
  expandedCommunities?: Set<number>;
  transactionPage?: number;
  financialSubView?: "overview" | "time_period" | "anomaly" | "income" | "expense" | "portfolio";
  timePeriodFinancials?: TimePeriodFinancials;
  anomalyData?: AnomalyDataDB;
  commandTypeAnalysis?: CommandTypeAnalysis;
  serverActivityTrends?: Array<{
    guildId: string;
    recentCount: number;
    previousCount: number;
    changePercentage: number;
  }>;
  anomalySubView?: "overview" | "abnormal_income" | "abnormal_expense" | "high_frequency" | "large_transactions" | "time_comparison";
}
