import Transport from "winston-transport";
import { EmbedBuilder, WebhookClient } from "discord.js";
import { generateFingerprint } from "./fingerprint";
import { classifyError, getSeverityColor, getSeverityEmoji } from "./classifier";
import { SlidingWindowRateLimiter } from "./rateLimiter";
import { ErrorAggregator } from "./aggregator";
import {
  EnhancedTransportOptions,
  NormalizedError,
  ErrorBucket,
  ErrorCategory,
  ErrorSeverity,
  TransportStats,
} from "./types";

const DEFAULT_OPTIONS = {
  windowDurationMs: 10 * 60 * 1000, // 10 minutes
  maxMessagesPerWindow: 15,
  aggregationWindowMs: 30 * 1000, // 30 seconds
  maxSamplesPerBucket: 3,
  summaryIntervalMs: 5 * 60 * 1000, // 5 minutes
  enableSummary: true,
  criticalBypassRateLimit: true,
} as const;

// Memory limits to prevent unbounded growth
const MAX_SUPPRESSED_BUCKETS = 100;
const MAX_QUEUE_SIZE = 50;

// Sensitive keys to exclude from metadata
const SENSITIVE_KEYS = [
  "password",
  "token",
  "secret",
  "apiKey",
  "api_key",
  "authorization",
  "cookie",
  "credential",
  "private",
];

/**
 * Enhanced Discord Webhook Transport for Winston
 *
 * Features:
 * - Error fingerprinting and aggregation (groups similar errors)
 * - Sliding window rate limiting (prevents flooding)
 * - Severity-based prioritization (CRITICAL errors bypass limits)
 * - Periodic summary reports (shows suppressed errors)
 */
export class EnhancedDiscordWebhookTransport extends Transport {
  private webhook: WebhookClient | null = null;
  private rateLimiter: SlidingWindowRateLimiter;
  private aggregator: ErrorAggregator;
  private options: {
    webhookUrl: string;
    windowDurationMs: number;
    maxMessagesPerWindow: number;
    aggregationWindowMs: number;
    maxSamplesPerBucket: number;
    summaryIntervalMs: number;
    enableSummary: boolean;
    criticalBypassRateLimit: boolean;
  };

  // Statistics
  private stats: TransportStats = {
    totalReceived: 0,
    totalSent: 0,
    totalAggregated: 0,
    totalSuppressed: 0,
    lastSummaryAt: null,
  };

  // Suppressed errors (for summary)
  private suppressedBuckets: Map<string, ErrorBucket> = new Map();

  // Timers
  private summaryTimer: NodeJS.Timeout | null = null;
  private pruneTimer: NodeJS.Timeout | null = null;

  // Message queue for ordered delivery
  private messageQueue: ErrorBucket[] = [];
  private isProcessing = false;

  constructor(opts: EnhancedTransportOptions) {
    super(opts);

    this.options = {
      webhookUrl: opts.webhookUrl,
      windowDurationMs: opts.windowDurationMs ?? DEFAULT_OPTIONS.windowDurationMs,
      maxMessagesPerWindow: opts.maxMessagesPerWindow ?? DEFAULT_OPTIONS.maxMessagesPerWindow,
      aggregationWindowMs: opts.aggregationWindowMs ?? DEFAULT_OPTIONS.aggregationWindowMs,
      maxSamplesPerBucket: opts.maxSamplesPerBucket ?? DEFAULT_OPTIONS.maxSamplesPerBucket,
      summaryIntervalMs: opts.summaryIntervalMs ?? DEFAULT_OPTIONS.summaryIntervalMs,
      enableSummary: opts.enableSummary ?? DEFAULT_OPTIONS.enableSummary,
      criticalBypassRateLimit: opts.criticalBypassRateLimit ?? DEFAULT_OPTIONS.criticalBypassRateLimit,
    };

    // Initialize webhook
    if (opts.webhookUrl) {
      try {
        this.webhook = new WebhookClient({ url: opts.webhookUrl });
      } catch (error) {
        console.error("Failed to initialize Discord webhook:", error);
      }
    }

    // Initialize rate limiter
    this.rateLimiter = new SlidingWindowRateLimiter(
      this.options.windowDurationMs,
      this.options.maxMessagesPerWindow
    );

    // Initialize aggregator
    this.aggregator = new ErrorAggregator(
      this.options.aggregationWindowMs,
      this.options.maxSamplesPerBucket,
      (bucket) => this.handleAggregatedBucket(bucket)
    );

    // Start summary timer
    if (this.options.enableSummary) {
      this.summaryTimer = setInterval(
        () => this.sendSummary(),
        this.options.summaryIntervalMs
      );
      // Allow Node.js to exit even if timer is running
      this.summaryTimer.unref();
    }

    // Start prune timer (every 10 minutes)
    this.pruneTimer = setInterval(
      () => {
        this.aggregator.prune(30 * 60 * 1000); // 30 min max age
        this.pruneSuppressedBuckets(); // Also prune suppressed buckets
      },
      10 * 60 * 1000
    );
    // Allow Node.js to exit even if timer is running
    this.pruneTimer.unref();
  }

  /**
   * Winston transport log method
   */
  log(info: any, callback: () => void): void {
    setImmediate(() => this.emit("logged", info));

    if (!this.webhook) {
      callback();
      return;
    }

    this.stats.totalReceived++;

    // Normalize and classify the error
    const normalized = this.normalizeError(info);

    // Add to aggregator
    const isNew = this.aggregator.add(normalized);

    if (!isNew) {
      this.stats.totalAggregated++;
    }

    // For CRITICAL errors, flush and send immediately (bypassing the normal flow)
    if (normalized.severity === ErrorSeverity.CRITICAL && isNew) {
      const bucket = this.aggregator.flushImmediately(normalized.fingerprint);
      if (bucket) {
        // Directly add to queue without going through handleAggregatedBucket
        // This avoids any confusion about rate limiting for CRITICAL errors
        this.rateLimiter.forceAcquire();
        this.messageQueue.push(bucket);
        this.processQueue();
      }
    }

    callback();
  }

  /**
   * Normalize incoming log info into standard format
   */
  private normalizeError(info: any): NormalizedError {
    const { category, severity } = classifyError(
      info.message,
      info.error?.name || info.name,
      info
    );

    const fingerprint = generateFingerprint({
      message: info.message,
      stack: info.stack || info.error?.stack,
      errorName: info.error?.name || info.name,
      category,
    });

    // Extract metadata (exclude standard and sensitive fields)
    const excludeKeys = ["level", "message", "timestamp", "stack", "error", "splat"];
    const metaKeys = Object.keys(info).filter((key) => {
      if (excludeKeys.includes(key)) return false;
      // Exclude sensitive keys (case-insensitive check)
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_KEYS.some((sensitive) => lowerKey.includes(sensitive))) return false;
      return true;
    });
    const metadata = metaKeys.reduce((obj: Record<string, unknown>, key) => {
      obj[key] = info[key];
      return obj;
    }, {});

    return {
      fingerprint,
      category,
      severity,
      message: info.message,
      stackTrace: info.stack || info.error?.stack || null,
      source: this.extractSource(info.stack || info.error?.stack),
      metadata,
      timestamp: new Date(info.timestamp || Date.now()),
    };
  }

  /**
   * Extract source file from stack trace
   */
  private extractSource(stack?: string): string | null {
    if (!stack) return null;

    const match = stack.match(/at\s+.+?\s+\((.+?):(\d+):(\d+)\)/);
    if (match) {
      return match[1].replace(/.*\/src\//, "src/");
    }
    return null;
  }

  /**
   * Handle an aggregated bucket ready for sending
   */
  private handleAggregatedBucket(bucket: ErrorBucket): void {
    // Check rate limit
    const canSend = this.checkRateLimit(bucket);

    if (!canSend) {
      // Store for summary (with size limit)
      if (this.suppressedBuckets.size >= MAX_SUPPRESSED_BUCKETS) {
        // Find and remove the oldest bucket
        let oldestKey: string | null = null;
        let oldestTime = Infinity;
        for (const [key, b] of this.suppressedBuckets) {
          if (b.lastOccurrence.getTime() < oldestTime) {
            oldestTime = b.lastOccurrence.getTime();
            oldestKey = key;
          }
        }
        if (oldestKey) {
          this.suppressedBuckets.delete(oldestKey);
        }
      }
      this.suppressedBuckets.set(bucket.fingerprint, bucket);
      this.stats.totalSuppressed += bucket.count;
      return;
    }

    // Prevent unbounded queue growth
    if (this.messageQueue.length >= MAX_QUEUE_SIZE) {
      // Drop oldest non-critical message, or oldest if all are critical
      const nonCriticalIdx = this.messageQueue.findIndex(
        (b) => b.severity !== ErrorSeverity.CRITICAL
      );
      let droppedBucket: ErrorBucket | undefined;
      if (nonCriticalIdx !== -1) {
        [droppedBucket] = this.messageQueue.splice(nonCriticalIdx, 1);
      } else {
        droppedBucket = this.messageQueue.shift();
      }
      // Track dropped errors and add to suppressedBuckets for summary reporting
      if (droppedBucket) {
        this.stats.totalSuppressed += droppedBucket.count;
        // Merge into suppressedBuckets so it appears in summary
        const existing = this.suppressedBuckets.get(droppedBucket.fingerprint);
        if (existing) {
          existing.count += droppedBucket.count;
          existing.lastOccurrence = droppedBucket.lastOccurrence;
        } else {
          this.suppressedBuckets.set(droppedBucket.fingerprint, droppedBucket);
        }
      }
    }

    // Add to queue for ordered delivery
    this.messageQueue.push(bucket);
    this.processQueue();
  }

  /**
   * Check if we can send based on rate limit and severity
   */
  private checkRateLimit(bucket: ErrorBucket): boolean {
    // CRITICAL errors can bypass rate limit
    if (
      this.options.criticalBypassRateLimit &&
      bucket.severity === ErrorSeverity.CRITICAL
    ) {
      this.rateLimiter.forceAcquire();
      return true;
    }

    return this.rateLimiter.tryAcquire();
  }

  /**
   * Process the message queue with rate limiting
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.messageQueue.length === 0 || !this.webhook) {
      return;
    }

    this.isProcessing = true;

    while (this.messageQueue.length > 0) {
      const bucket = this.messageQueue.shift();
      if (!bucket) continue;

      try {
        await this.sendBucketToDiscord(bucket);
        this.stats.totalSent++;
        // Small delay between messages to avoid Discord rate limits
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error: any) {
        // Handle Discord 429 (rate limit) with retry_after
        if (error.status === 429 || error.httpStatus === 429) {
          const retryAfter = error.retryAfter ?? error.retry_after ?? 5000;
          console.error(
            `Discord rate limited. Waiting ${retryAfter}ms before retry...`
          );
          // Put the bucket back at the front of the queue
          this.messageQueue.unshift(bucket);
          await new Promise((resolve) => setTimeout(resolve, retryAfter));
        } else {
          console.error("Failed to send error to Discord:", error);
        }
      }
    }

    this.isProcessing = false;
  }

  /**
   * Send an aggregated bucket to Discord
   */
  private async sendBucketToDiscord(bucket: ErrorBucket): Promise<void> {
    if (!this.webhook) return;

    const embed = this.createBucketEmbed(bucket);

    try {
      await this.webhook.send({
        embeds: [embed],
        username: "Error Monitor",
      });
    } catch (error: any) {
      // If the message is too long, send a simplified version
      if (error.code === 50035) {
        const simpleEmbed = this.createSimplifiedEmbed(bucket);
        await this.webhook.send({
          embeds: [simpleEmbed],
          username: "Error Monitor",
        });
      } else {
        throw error;
      }
    }
  }

  /**
   * Create embed for an error bucket
   */
  private createBucketEmbed(bucket: ErrorBucket): EmbedBuilder {
    const error = bucket.representativeError;
    const color = getSeverityColor(bucket.severity);

    // Title with count if aggregated
    const countSuffix = bucket.count > 1 ? ` (x${bucket.count})` : "";
    const title = `${getSeverityEmoji(bucket.severity)} ${bucket.category}${countSuffix}`;

    // Build description
    let description = error.message;
    if (description.length > 2000) {
      description = description.substring(0, 1997) + "...";
    }

    // Add stack trace if available
    if (error.stackTrace) {
      const stackPrefix = "\n\n**Stack Trace:**\n```";
      const stackSuffix = "```";
      const availableSpace =
        4096 - description.length - stackPrefix.length - stackSuffix.length;

      if (availableSpace > 100) {
        const stackTrace =
          error.stackTrace.length > availableSpace
            ? error.stackTrace.substring(0, availableSpace - 3) + "..."
            : error.stackTrace;
        description += `${stackPrefix}${stackTrace}${stackSuffix}`;
      }
    }

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(title)
      .setDescription(description)
      .setTimestamp(error.timestamp);

    // Add occurrence info for aggregated errors
    if (bucket.count > 1) {
      embed.addFields({
        name: "發生次數",
        value: `**${bucket.count}** 次，從 ${this.formatTime(bucket.firstOccurrence)} 到 ${this.formatTime(bucket.lastOccurrence)}`,
        inline: false,
      });
    }

    // Add source if available
    if (error.source) {
      embed.addFields({
        name: "來源",
        value: `\`${error.source}\``,
        inline: true,
      });
    }

    // Add fingerprint for reference
    embed.addFields({
      name: "指紋",
      value: `\`${bucket.fingerprint}\``,
      inline: true,
    });

    return embed;
  }

  /**
   * Create simplified embed for when the full one is too long
   */
  private createSimplifiedEmbed(bucket: ErrorBucket): EmbedBuilder {
    const error = bucket.representativeError;
    const color = getSeverityColor(bucket.severity);
    const countSuffix = bucket.count > 1 ? ` (x${bucket.count})` : "";

    return new EmbedBuilder()
      .setColor(color)
      .setTitle(`${getSeverityEmoji(bucket.severity)} ${bucket.category}${countSuffix}`)
      .setDescription(error.message.substring(0, 500) + "...")
      .addFields({
        name: "指紋",
        value: `\`${bucket.fingerprint}\``,
        inline: true,
      })
      .setTimestamp(error.timestamp);
  }

  /**
   * Send periodic summary of suppressed errors
   */
  private async sendSummary(): Promise<void> {
    if (!this.webhook) return;

    const updatedBuckets = this.aggregator.getUpdatedBuckets();
    const suppressedCount = this.suppressedBuckets.size;

    // Skip if no suppressed errors and no significant updates
    if (suppressedCount === 0 && updatedBuckets.length === 0) {
      return;
    }

    // Calculate total suppressed
    let totalSuppressedErrors = 0;
    for (const bucket of this.suppressedBuckets.values()) {
      totalSuppressedErrors += bucket.count;
    }

    // Skip if no suppressed errors to report
    if (totalSuppressedErrors === 0) {
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x3498db) // Blue for summary
      .setTitle("📊 錯誤摘要報告")
      .setTimestamp(new Date());

    // Rate limiter status
    const rlStats = this.rateLimiter.getStats();
    embed.addFields({
      name: "速率限制狀態",
      value: `${rlStats.used}/${rlStats.max} 訊息已使用（${Math.round(rlStats.windowMs / 60000)} 分鐘視窗）`,
      inline: false,
    });

    // Suppressed errors breakdown
    if (suppressedCount > 0) {
      let suppressedSummary = "";

      // Group by category
      const byCategory = new Map<ErrorCategory, { count: number; fingerprints: string[] }>();
      for (const bucket of this.suppressedBuckets.values()) {
        const existing = byCategory.get(bucket.category) || { count: 0, fingerprints: [] };
        existing.count += bucket.count;
        existing.fingerprints.push(bucket.fingerprint.substring(0, 8));
        byCategory.set(bucket.category, existing);
      }

      for (const [category, data] of byCategory) {
        suppressedSummary += `- **${category}**: ${data.count} 個錯誤\n`;
      }

      embed.addFields({
        name: `被抑制的錯誤（共 ${totalSuppressedErrors} 個，${suppressedCount} 種）`,
        value: suppressedSummary.substring(0, 1024) || "無",
        inline: false,
      });
    }

    // Overall stats
    embed.addFields({
      name: "統計資料",
      value: [
        `收到: **${this.stats.totalReceived}**`,
        `已發送: **${this.stats.totalSent}**`,
        `已聚合: **${this.stats.totalAggregated}**`,
        `被抑制: **${this.stats.totalSuppressed}**`,
      ].join(" | "),
      inline: false,
    });

    try {
      await this.webhook.send({
        embeds: [embed],
        username: "Error Monitor",
      });

      // Clear suppressed buckets after summary
      this.suppressedBuckets.clear();
      this.stats.lastSummaryAt = new Date();
    } catch (error) {
      console.error("Failed to send error summary:", error);
    }
  }

  /**
   * Format time for display
   */
  private formatTime(date: Date): string {
    return date.toLocaleTimeString("zh-TW", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  }

  /**
   * Get current statistics
   */
  public getStats(): TransportStats {
    return { ...this.stats };
  }

  /**
   * Prune old suppressed buckets to prevent memory growth
   */
  private pruneSuppressedBuckets(): void {
    if (this.suppressedBuckets.size <= MAX_SUPPRESSED_BUCKETS) {
      return;
    }

    // Sort by lastOccurrence and keep only the newest ones
    const sorted = [...this.suppressedBuckets.entries()].sort(
      (a, b) => b[1].lastOccurrence.getTime() - a[1].lastOccurrence.getTime()
    );

    this.suppressedBuckets.clear();
    for (let i = 0; i < MAX_SUPPRESSED_BUCKETS && i < sorted.length; i++) {
      this.suppressedBuckets.set(sorted[i][0], sorted[i][1]);
    }
  }

  /**
   * Cleanup on transport close
   */
  close(): void {
    if (this.summaryTimer) {
      clearInterval(this.summaryTimer);
      this.summaryTimer = null;
    }
    if (this.pruneTimer) {
      clearInterval(this.pruneTimer);
      this.pruneTimer = null;
    }
    this.aggregator.reset();
    if (this.webhook) {
      this.webhook.destroy();
      this.webhook = null;
    }
  }
}

// Re-export types and utilities
export * from "./types";
export { classifyError, getSeverityColor, getSeverityEmoji } from "./classifier";
export { generateFingerprint } from "./fingerprint";
