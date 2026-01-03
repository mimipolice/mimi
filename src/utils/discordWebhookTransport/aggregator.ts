import {
  ErrorBucket,
  ErrorCategory,
  ErrorSeverity,
  NormalizedError,
} from "./types";

/**
 * Error Aggregator
 *
 * Groups similar errors (by fingerprint) into buckets and delays sending
 * to allow aggregation. This prevents flooding when many identical errors
 * occur in a short time.
 */
export class ErrorAggregator {
  private buckets: Map<string, ErrorBucket> = new Map();
  private readonly aggregationWindowMs: number;
  private readonly maxSamplesPerBucket: number;
  private readonly flushCallback: (bucket: ErrorBucket) => void;
  private pendingFlushTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    aggregationWindowMs: number,
    maxSamplesPerBucket: number,
    flushCallback: (bucket: ErrorBucket) => void
  ) {
    this.aggregationWindowMs = aggregationWindowMs;
    this.maxSamplesPerBucket = maxSamplesPerBucket;
    this.flushCallback = flushCallback;
  }

  /**
   * Add an error to the aggregator.
   * Returns true if this is the first occurrence (new bucket created).
   */
  public add(error: NormalizedError): boolean {
    const existing = this.buckets.get(error.fingerprint);

    if (existing) {
      // Update existing bucket
      existing.count++;
      existing.lastOccurrence = error.timestamp;

      // Keep sample metadata (up to max)
      if (existing.sampleMetadata.length < this.maxSamplesPerBucket) {
        existing.sampleMetadata.push(error.metadata);
      }

      return false;
    }

    // Create new bucket
    const bucket: ErrorBucket = {
      fingerprint: error.fingerprint,
      category: error.category,
      severity: error.severity,
      representativeError: error,
      count: 1,
      firstOccurrence: error.timestamp,
      lastOccurrence: error.timestamp,
      sampleMetadata: Object.keys(error.metadata).length > 0 ? [error.metadata] : [],
      notificationSent: false,
      lastNotifiedAt: null,
    };
    this.buckets.set(error.fingerprint, bucket);

    // Schedule flush for this bucket (unless CRITICAL, which flushes immediately)
    if (error.severity !== ErrorSeverity.CRITICAL) {
      this.scheduleFlush(error.fingerprint);
    }

    return true;
  }

  /**
   * Immediately flush a bucket (for CRITICAL errors).
   * Returns the bucket if it exists and hasn't been sent yet.
   */
  public flushImmediately(fingerprint: string): ErrorBucket | null {
    const bucket = this.buckets.get(fingerprint);
    if (!bucket || bucket.notificationSent) {
      return null;
    }

    // Cancel any pending flush timer
    const timer = this.pendingFlushTimers.get(fingerprint);
    if (timer) {
      clearTimeout(timer);
      this.pendingFlushTimers.delete(fingerprint);
    }

    bucket.notificationSent = true;
    bucket.lastNotifiedAt = new Date();

    return bucket;
  }

  /**
   * Schedule a bucket to be flushed after the aggregation window.
   */
  private scheduleFlush(fingerprint: string): void {
    const timer = setTimeout(() => {
      this.pendingFlushTimers.delete(fingerprint);
      this.flushBucket(fingerprint);
    }, this.aggregationWindowMs);

    this.pendingFlushTimers.set(fingerprint, timer);
  }

  /**
   * Flush a specific bucket.
   */
  private flushBucket(fingerprint: string): void {
    const bucket = this.buckets.get(fingerprint);
    if (!bucket || bucket.notificationSent) return;

    bucket.notificationSent = true;
    bucket.lastNotifiedAt = new Date();
    this.flushCallback(bucket);
  }

  /**
   * Flush all pending buckets (for shutdown or summary).
   * Returns the flushed buckets.
   */
  public flushAll(): ErrorBucket[] {
    const flushed: ErrorBucket[] = [];

    for (const [fingerprint, bucket] of this.buckets) {
      if (!bucket.notificationSent) {
        // Cancel any pending timer
        const timer = this.pendingFlushTimers.get(fingerprint);
        if (timer) {
          clearTimeout(timer);
          this.pendingFlushTimers.delete(fingerprint);
        }

        bucket.notificationSent = true;
        bucket.lastNotifiedAt = new Date();
        flushed.push(bucket);
      }
    }

    return flushed;
  }

  /**
   * Get all buckets that received new errors after being notified.
   * Useful for follow-up notifications in summaries.
   */
  public getUpdatedBuckets(): ErrorBucket[] {
    const updated: ErrorBucket[] = [];

    for (const bucket of this.buckets.values()) {
      if (
        bucket.notificationSent &&
        bucket.lastNotifiedAt &&
        bucket.lastOccurrence > bucket.lastNotifiedAt
      ) {
        updated.push(bucket);
      }
    }

    return updated;
  }

  /**
   * Get a bucket by fingerprint.
   */
  public getBucket(fingerprint: string): ErrorBucket | undefined {
    return this.buckets.get(fingerprint);
  }

  /**
   * Clear old buckets (call periodically to prevent memory growth).
   */
  public prune(maxAgeMs: number): number {
    const now = Date.now();
    let prunedCount = 0;

    for (const [fingerprint, bucket] of this.buckets) {
      const age = now - bucket.lastOccurrence.getTime();
      if (age > maxAgeMs) {
        // Cancel any pending timer
        const timer = this.pendingFlushTimers.get(fingerprint);
        if (timer) {
          clearTimeout(timer);
          this.pendingFlushTimers.delete(fingerprint);
        }

        this.buckets.delete(fingerprint);
        prunedCount++;
      }
    }

    return prunedCount;
  }

  /**
   * Get statistics for summary reports.
   */
  public getStats(): {
    activeBuckets: number;
    totalErrors: number;
    byCategoryCount: Map<ErrorCategory, number>;
  } {
    let totalErrors = 0;
    const byCategoryCount = new Map<ErrorCategory, number>();

    for (const bucket of this.buckets.values()) {
      totalErrors += bucket.count;
      const current = byCategoryCount.get(bucket.category) || 0;
      byCategoryCount.set(bucket.category, current + bucket.count);
    }

    return {
      activeBuckets: this.buckets.size,
      totalErrors,
      byCategoryCount,
    };
  }

  /**
   * Reset all buckets (useful for testing).
   */
  public reset(): void {
    // Cancel all pending timers
    for (const timer of this.pendingFlushTimers.values()) {
      clearTimeout(timer);
    }
    this.pendingFlushTimers.clear();
    this.buckets.clear();
  }
}
