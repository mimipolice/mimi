/**
 * Sliding Window Rate Limiter
 *
 * Implements a sliding window algorithm to limit the number of messages
 * that can be sent within a time window. Unlike a fixed window, this
 * prevents bursts at window boundaries.
 */
export class SlidingWindowRateLimiter {
  private readonly windowDurationMs: number;
  private readonly maxMessages: number;
  private timestamps: number[] = [];

  constructor(windowDurationMs: number, maxMessages: number) {
    this.windowDurationMs = windowDurationMs;
    this.maxMessages = maxMessages;
  }

  /**
   * Try to acquire a slot. If successful, records the timestamp and returns true.
   * If rate limited, returns false without recording.
   */
  public tryAcquire(): boolean {
    const now = Date.now();
    this.pruneExpired(now);

    if (this.timestamps.length >= this.maxMessages) {
      return false;
    }

    this.timestamps.push(now);
    return true;
  }

  /**
   * Check if we can send without actually recording the attempt.
   * Useful for checking before preparing a message.
   */
  public canSend(): boolean {
    const now = Date.now();
    this.pruneExpired(now);
    return this.timestamps.length < this.maxMessages;
  }

  /**
   * Force acquire a slot (for CRITICAL errors that bypass rate limit).
   * Always records the timestamp, even if over limit.
   */
  public forceAcquire(): void {
    this.timestamps.push(Date.now());
  }

  /**
   * Get the remaining quota in current window.
   */
  public getRemainingQuota(): number {
    const now = Date.now();
    this.pruneExpired(now);
    return Math.max(0, this.maxMessages - this.timestamps.length);
  }

  /**
   * Get time until the next slot becomes available (in ms).
   * Returns 0 if a slot is available now.
   */
  public getTimeUntilNextSlot(): number {
    if (this.timestamps.length === 0) return 0;

    const now = Date.now();
    this.pruneExpired(now);

    if (this.timestamps.length < this.maxMessages) return 0;

    // Calculate when the oldest message will expire
    const oldestTimestamp = this.timestamps[0];
    return Math.max(0, oldestTimestamp + this.windowDurationMs - now);
  }

  /**
   * Get current usage statistics.
   */
  public getStats(): { used: number; max: number; windowMs: number } {
    const now = Date.now();
    this.pruneExpired(now);
    return {
      used: this.timestamps.length,
      max: this.maxMessages,
      windowMs: this.windowDurationMs,
    };
  }

  /**
   * Remove timestamps that have expired (outside the window).
   * Uses shift() for efficiency since timestamps are in chronological order.
   */
  private pruneExpired(now: number): void {
    const cutoff = now - this.windowDurationMs;
    // Since timestamps are added in order, we can shift from the front
    while (this.timestamps.length > 0 && this.timestamps[0] <= cutoff) {
      this.timestamps.shift();
    }
  }

  /**
   * Reset the rate limiter (useful for testing or recovery).
   */
  public reset(): void {
    this.timestamps = [];
  }
}
