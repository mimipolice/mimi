/**
 * Content Generators - Central Export Point
 * 
 * This module serves as the central export point for all content generation
 * functions used in the user-info command. It re-exports functions from
 * specialized modules organized by functional domain.
 * 
 * Module Organization:
 * - general-content: General overview and usage pattern analysis
 * - financial-content: Financial analysis and reporting
 * - anomaly-content: Anomaly detection and risk assessment
 * - relationship-content: Relationship network analysis
 * - details-content: Detailed transaction records and interactions
 * - types: Shared type definitions
 * 
 * Requirements: 1.4, 2.1, 2.2, 2.3, 4.2, 5.2, 5.4
 */

// Re-export all functions from general-content.ts
export {
  createGeneralContent,
  createUsagePatternContent,
  getNoDataMessage,
} from "./general-content";

// Re-export all functions from financial-content.ts
export {
  createFinancialContent,
  createFinancialOverviewContent,
  createTimePeriodAnalysisContent,
  createIncomeAnalysisContent,
  createExpenseAnalysisContent,
  createPortfolioContent,
} from "./financial-content";

// Re-export all functions from anomaly-content.ts
export {
  createAnomalyOverviewContent,
  createAbnormalIncomeContent,
  createAbnormalExpenseContent,
  createHighFrequencyContent,
  createLargeTransactionsContent,
  createTimeComparisonContent,
} from "./anomaly-content";

// Re-export all functions from relationship-content.ts
export {
  createRelationshipContent,
} from "./relationship-content";

// Re-export all functions from details-content.ts
export {
  createDetailsContent,
  createInteractionsContent,
} from "./details-content";

// Re-export types from types.ts
export type {
  ContentGeneratorOptions,
} from "./types";
