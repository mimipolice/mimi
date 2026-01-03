import Transport from "winston-transport";

/**
 * Error classification categories for grouping similar errors
 */
export enum ErrorCategory {
  DATABASE_CONNECTION = "DATABASE_CONNECTION",
  DATABASE_QUERY = "DATABASE_QUERY",
  DISCORD_API = "DISCORD_API",
  REDIS_CONNECTION = "REDIS_CONNECTION",
  NETWORK = "NETWORK",
  VALIDATION = "VALIDATION",
  PERMISSION = "PERMISSION",
  RATE_LIMIT = "RATE_LIMIT",
  UNKNOWN = "UNKNOWN",
}

/**
 * Severity levels for prioritizing error notifications
 */
export enum ErrorSeverity {
  CRITICAL = "CRITICAL", // Immediate notification required (bypasses rate limit)
  HIGH = "HIGH", // Should be aggregated but sent quickly
  MEDIUM = "MEDIUM", // Can be batched
  LOW = "LOW", // Can be heavily aggregated
}

/**
 * Normalized error entry after processing
 */
export interface NormalizedError {
  fingerprint: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  stackTrace: string | null;
  source: string | null;
  metadata: Record<string, unknown>;
  timestamp: Date;
}

/**
 * Aggregated error bucket for similar errors
 */
export interface ErrorBucket {
  fingerprint: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  representativeError: NormalizedError;
  count: number;
  firstOccurrence: Date;
  lastOccurrence: Date;
  sampleMetadata: Array<Record<string, unknown>>;
  notificationSent: boolean;
  lastNotifiedAt: Date | null;
}

/**
 * Transport configuration options
 */
export interface EnhancedTransportOptions
  extends Transport.TransportStreamOptions {
  webhookUrl: string;
  level?: string;

  // Rate limiting
  /** Duration of the rate limit window in milliseconds (default: 600000 = 10 minutes) */
  windowDurationMs?: number;
  /** Maximum messages allowed per window (default: 15) */
  maxMessagesPerWindow?: number;

  // Aggregation
  /** How long to wait before sending aggregated errors (default: 30000 = 30 seconds) */
  aggregationWindowMs?: number;
  /** Maximum metadata samples to keep per bucket (default: 3) */
  maxSamplesPerBucket?: number;

  // Summary
  /** Interval for sending summary reports (default: 300000 = 5 minutes) */
  summaryIntervalMs?: number;
  /** Whether to send periodic summary reports (default: true) */
  enableSummary?: boolean;

  // Severity bypass
  /** Whether CRITICAL errors bypass rate limit (default: true) */
  criticalBypassRateLimit?: boolean;
}

/**
 * Statistics for tracking transport activity
 */
export interface TransportStats {
  totalReceived: number;
  totalSent: number;
  totalAggregated: number;
  totalSuppressed: number;
  lastSummaryAt: Date | null;
}
