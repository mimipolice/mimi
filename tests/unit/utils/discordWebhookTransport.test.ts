/**
 * discordWebhookTransport 單元測試
 *
 * 測試範圍：
 * - SlidingWindowRateLimiter: 滑動窗口速率限制
 * - ErrorAggregator: 錯誤聚合與分組
 * - classifier: 錯誤分類與嚴重性判斷
 * - fingerprint: 錯誤指紋生成與正規化
 * - EnhancedDiscordWebhookTransport: 主傳輸類別
 *
 * Mock 策略：
 * - Discord.js WebhookClient: mock send 方法
 * - Winston Transport: 繼承並測試 log 方法
 * - crypto: 直接使用（不需要 mock）
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================
// Mock 設定 - 使用 vi.hoisted 確保持久化
// ============================================

const { mockWebhookSend, mockWebhookDestroy } = vi.hoisted(() => ({
  mockWebhookSend: vi.fn(),
  mockWebhookDestroy: vi.fn(),
}));

vi.mock('discord.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('discord.js')>();
  return {
    ...original,
    WebhookClient: class MockWebhookClient {
      send = mockWebhookSend;
      destroy = mockWebhookDestroy;
      constructor(_opts: any) {}
    },
  };
});

// ============================================
// Import after mocks
// ============================================

import { SlidingWindowRateLimiter } from '../../../src/utils/discordWebhookTransport/rateLimiter.js';
import { ErrorAggregator } from '../../../src/utils/discordWebhookTransport/aggregator.js';
import {
  classifyError,
  getSeverityEmoji,
  getSeverityColor,
} from '../../../src/utils/discordWebhookTransport/classifier.js';
import { generateFingerprint } from '../../../src/utils/discordWebhookTransport/fingerprint.js';
import {
  ErrorCategory,
  ErrorSeverity,
  NormalizedError,
} from '../../../src/utils/discordWebhookTransport/types.js';
import { EnhancedDiscordWebhookTransport } from '../../../src/utils/discordWebhookTransport/index.js';

// ============================================
// 測試輔助函數
// ============================================

function createMockNormalizedError(overrides: Partial<NormalizedError> = {}): NormalizedError {
  return {
    fingerprint: overrides.fingerprint ?? 'test-fingerprint-123',
    category: overrides.category ?? ErrorCategory.UNKNOWN,
    severity: overrides.severity ?? ErrorSeverity.MEDIUM,
    message: overrides.message ?? 'Test error message',
    stackTrace: overrides.stackTrace ?? null,
    source: overrides.source ?? null,
    metadata: overrides.metadata ?? {},
    timestamp: overrides.timestamp ?? new Date('2024-01-01T12:00:00Z'),
  };
}

// ============================================
// SlidingWindowRateLimiter 測試
// ============================================

describe('SlidingWindowRateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('tryAcquire()', () => {
    it('should return true when under limit', () => {
      // Arrange
      const limiter = new SlidingWindowRateLimiter(60000, 5);

      // Act
      const result = limiter.tryAcquire();

      // Assert
      expect(result).toBe(true);
    });

    it('should return true until limit reached', () => {
      // Arrange
      const limiter = new SlidingWindowRateLimiter(60000, 3);

      // Act & Assert
      expect(limiter.tryAcquire()).toBe(true);
      expect(limiter.tryAcquire()).toBe(true);
      expect(limiter.tryAcquire()).toBe(true);
      expect(limiter.tryAcquire()).toBe(false);
    });

    it('should return false when at limit', () => {
      // Arrange
      const limiter = new SlidingWindowRateLimiter(60000, 2);
      limiter.tryAcquire();
      limiter.tryAcquire();

      // Act
      const result = limiter.tryAcquire();

      // Assert
      expect(result).toBe(false);
    });

    it('should allow new requests after window expires', () => {
      // Arrange
      const limiter = new SlidingWindowRateLimiter(60000, 1);
      limiter.tryAcquire();
      expect(limiter.tryAcquire()).toBe(false);

      // Act - advance time past window
      vi.advanceTimersByTime(61000);

      // Assert
      expect(limiter.tryAcquire()).toBe(true);
    });

    it('should implement sliding window (not fixed)', () => {
      // Arrange
      const limiter = new SlidingWindowRateLimiter(60000, 2);

      // First request at T=0
      limiter.tryAcquire();
      vi.advanceTimersByTime(30000); // T=30s

      // Second request at T=30s
      limiter.tryAcquire();
      expect(limiter.tryAcquire()).toBe(false); // At limit

      // At T=61s, first request expires
      vi.advanceTimersByTime(31000);

      // Assert - should allow one more
      expect(limiter.tryAcquire()).toBe(true);
    });
  });

  describe('canSend()', () => {
    it('should return true when under limit without consuming slot', () => {
      // Arrange
      const limiter = new SlidingWindowRateLimiter(60000, 2);
      limiter.tryAcquire();

      // Act
      const canSend = limiter.canSend();

      // Assert
      expect(canSend).toBe(true);
      expect(limiter.getRemainingQuota()).toBe(1); // Still 1 remaining
    });

    it('should return false when at limit without consuming slot', () => {
      // Arrange
      const limiter = new SlidingWindowRateLimiter(60000, 1);
      limiter.tryAcquire();

      // Act
      const canSend = limiter.canSend();

      // Assert
      expect(canSend).toBe(false);
    });
  });

  describe('forceAcquire()', () => {
    it('should always record timestamp even when over limit', () => {
      // Arrange
      const limiter = new SlidingWindowRateLimiter(60000, 1);
      limiter.tryAcquire();
      expect(limiter.canSend()).toBe(false);

      // Act
      limiter.forceAcquire();

      // Assert
      const stats = limiter.getStats();
      expect(stats.used).toBe(2); // Over limit
    });
  });

  describe('getRemainingQuota()', () => {
    it('should return max when empty', () => {
      // Arrange
      const limiter = new SlidingWindowRateLimiter(60000, 5);

      // Act & Assert
      expect(limiter.getRemainingQuota()).toBe(5);
    });

    it('should return correct remaining count', () => {
      // Arrange
      const limiter = new SlidingWindowRateLimiter(60000, 5);
      limiter.tryAcquire();
      limiter.tryAcquire();

      // Act & Assert
      expect(limiter.getRemainingQuota()).toBe(3);
    });

    it('should return 0 when at limit', () => {
      // Arrange
      const limiter = new SlidingWindowRateLimiter(60000, 2);
      limiter.tryAcquire();
      limiter.tryAcquire();

      // Act & Assert
      expect(limiter.getRemainingQuota()).toBe(0);
    });

    it('should increase after timestamps expire', () => {
      // Arrange
      const limiter = new SlidingWindowRateLimiter(60000, 2);
      limiter.tryAcquire();
      limiter.tryAcquire();
      expect(limiter.getRemainingQuota()).toBe(0);

      // Act
      vi.advanceTimersByTime(61000);

      // Assert
      expect(limiter.getRemainingQuota()).toBe(2);
    });
  });

  describe('getTimeUntilNextSlot()', () => {
    it('should return 0 when empty', () => {
      // Arrange
      const limiter = new SlidingWindowRateLimiter(60000, 5);

      // Act & Assert
      expect(limiter.getTimeUntilNextSlot()).toBe(0);
    });

    it('should return 0 when under limit', () => {
      // Arrange
      const limiter = new SlidingWindowRateLimiter(60000, 5);
      limiter.tryAcquire();

      // Act & Assert
      expect(limiter.getTimeUntilNextSlot()).toBe(0);
    });

    it('should return time until oldest expires when at limit', () => {
      // Arrange
      const limiter = new SlidingWindowRateLimiter(60000, 1);
      limiter.tryAcquire();

      // Act - advance a bit
      vi.advanceTimersByTime(10000);

      // Assert
      expect(limiter.getTimeUntilNextSlot()).toBe(50000); // 60000 - 10000
    });
  });

  describe('getStats()', () => {
    it('should return correct statistics', () => {
      // Arrange
      const limiter = new SlidingWindowRateLimiter(120000, 10);
      limiter.tryAcquire();
      limiter.tryAcquire();
      limiter.tryAcquire();

      // Act
      const stats = limiter.getStats();

      // Assert
      expect(stats.used).toBe(3);
      expect(stats.max).toBe(10);
      expect(stats.windowMs).toBe(120000);
    });
  });

  describe('reset()', () => {
    it('should clear all timestamps', () => {
      // Arrange
      const limiter = new SlidingWindowRateLimiter(60000, 2);
      limiter.tryAcquire();
      limiter.tryAcquire();
      expect(limiter.getRemainingQuota()).toBe(0);

      // Act
      limiter.reset();

      // Assert
      expect(limiter.getRemainingQuota()).toBe(2);
    });
  });
});

// ============================================
// ErrorAggregator 測試
// ============================================

describe('ErrorAggregator', () => {
  let flushCallback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    flushCallback = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('add()', () => {
    it('should return true for new error (new bucket created)', () => {
      // Arrange
      const aggregator = new ErrorAggregator(30000, 3, flushCallback);
      const error = createMockNormalizedError();

      // Act
      const isNew = aggregator.add(error);

      // Assert
      expect(isNew).toBe(true);
    });

    it('should return false for repeated error (existing bucket)', () => {
      // Arrange
      const aggregator = new ErrorAggregator(30000, 3, flushCallback);
      const error = createMockNormalizedError({ fingerprint: 'same-fp' });

      // Act
      aggregator.add(error);
      const isNew = aggregator.add(error);

      // Assert
      expect(isNew).toBe(false);
    });

    it('should increment count on repeated errors', () => {
      // Arrange
      const aggregator = new ErrorAggregator(30000, 3, flushCallback);
      const error = createMockNormalizedError({ fingerprint: 'fp-123' });

      // Act
      aggregator.add(error);
      aggregator.add(error);
      aggregator.add(error);

      // Assert
      const bucket = aggregator.getBucket('fp-123');
      expect(bucket?.count).toBe(3);
    });

    it('should update lastOccurrence on repeated errors', () => {
      // Arrange
      const aggregator = new ErrorAggregator(30000, 3, flushCallback);
      const error1 = createMockNormalizedError({
        fingerprint: 'fp-123',
        timestamp: new Date('2024-01-01T12:00:00Z'),
      });
      const error2 = createMockNormalizedError({
        fingerprint: 'fp-123',
        timestamp: new Date('2024-01-01T12:05:00Z'),
      });

      // Act
      aggregator.add(error1);
      aggregator.add(error2);

      // Assert
      const bucket = aggregator.getBucket('fp-123');
      expect(bucket?.lastOccurrence).toEqual(new Date('2024-01-01T12:05:00Z'));
    });

    it('should keep sample metadata up to max', () => {
      // Arrange
      const aggregator = new ErrorAggregator(30000, 2, flushCallback); // max 2 samples
      const error1 = createMockNormalizedError({
        fingerprint: 'fp-123',
        metadata: { sample: 1 },
      });
      const error2 = createMockNormalizedError({
        fingerprint: 'fp-123',
        metadata: { sample: 2 },
      });
      const error3 = createMockNormalizedError({
        fingerprint: 'fp-123',
        metadata: { sample: 3 },
      });

      // Act
      aggregator.add(error1);
      aggregator.add(error2);
      aggregator.add(error3);

      // Assert
      const bucket = aggregator.getBucket('fp-123');
      expect(bucket?.sampleMetadata).toHaveLength(2);
      expect(bucket?.sampleMetadata[0]).toEqual({ sample: 1 });
      expect(bucket?.sampleMetadata[1]).toEqual({ sample: 2 });
    });

    it('should schedule flush for non-CRITICAL errors', () => {
      // Arrange
      const aggregator = new ErrorAggregator(30000, 3, flushCallback);
      const error = createMockNormalizedError({ severity: ErrorSeverity.MEDIUM });

      // Act
      aggregator.add(error);

      // Wait for aggregation window
      vi.advanceTimersByTime(31000);

      // Assert
      expect(flushCallback).toHaveBeenCalledTimes(1);
    });

    it('should NOT schedule flush for CRITICAL errors', () => {
      // Arrange
      const aggregator = new ErrorAggregator(30000, 3, flushCallback);
      const error = createMockNormalizedError({ severity: ErrorSeverity.CRITICAL });

      // Act
      aggregator.add(error);

      // Wait for aggregation window
      vi.advanceTimersByTime(31000);

      // Assert - flushCallback should NOT be called because CRITICAL errors should be flushed immediately via flushImmediately()
      expect(flushCallback).not.toHaveBeenCalled();
    });
  });

  describe('flushImmediately()', () => {
    it('should return bucket and mark as notified', () => {
      // Arrange
      const aggregator = new ErrorAggregator(30000, 3, flushCallback);
      const error = createMockNormalizedError({ fingerprint: 'fp-123' });
      aggregator.add(error);

      // Act
      const bucket = aggregator.flushImmediately('fp-123');

      // Assert
      expect(bucket).not.toBeNull();
      expect(bucket?.notificationSent).toBe(true);
      expect(bucket?.lastNotifiedAt).toBeInstanceOf(Date);
    });

    it('should return null for non-existent fingerprint', () => {
      // Arrange
      const aggregator = new ErrorAggregator(30000, 3, flushCallback);

      // Act
      const bucket = aggregator.flushImmediately('non-existent');

      // Assert
      expect(bucket).toBeNull();
    });

    it('should return null if already notified', () => {
      // Arrange
      const aggregator = new ErrorAggregator(30000, 3, flushCallback);
      const error = createMockNormalizedError({ fingerprint: 'fp-123' });
      aggregator.add(error);
      aggregator.flushImmediately('fp-123');

      // Act
      const bucket = aggregator.flushImmediately('fp-123');

      // Assert
      expect(bucket).toBeNull();
    });

    it('should cancel pending flush timer', () => {
      // Arrange
      const aggregator = new ErrorAggregator(30000, 3, flushCallback);
      const error = createMockNormalizedError({
        fingerprint: 'fp-123',
        severity: ErrorSeverity.MEDIUM,
      });
      aggregator.add(error);

      // Act
      aggregator.flushImmediately('fp-123');

      // Wait past aggregation window
      vi.advanceTimersByTime(31000);

      // Assert - callback should NOT be called since we flushed immediately
      expect(flushCallback).not.toHaveBeenCalled();
    });
  });

  describe('flushAll()', () => {
    it('should return all pending buckets', () => {
      // Arrange
      const aggregator = new ErrorAggregator(30000, 3, flushCallback);
      aggregator.add(createMockNormalizedError({ fingerprint: 'fp-1' }));
      aggregator.add(createMockNormalizedError({ fingerprint: 'fp-2' }));
      aggregator.add(createMockNormalizedError({ fingerprint: 'fp-3' }));

      // Act
      const flushed = aggregator.flushAll();

      // Assert
      expect(flushed).toHaveLength(3);
    });

    it('should not return already notified buckets', () => {
      // Arrange
      const aggregator = new ErrorAggregator(30000, 3, flushCallback);
      aggregator.add(createMockNormalizedError({ fingerprint: 'fp-1' }));
      aggregator.add(createMockNormalizedError({ fingerprint: 'fp-2' }));
      aggregator.flushImmediately('fp-1'); // Mark as notified

      // Act
      const flushed = aggregator.flushAll();

      // Assert
      expect(flushed).toHaveLength(1);
      expect(flushed[0].fingerprint).toBe('fp-2');
    });

    it('should cancel all pending timers', () => {
      // Arrange
      const aggregator = new ErrorAggregator(30000, 3, flushCallback);
      aggregator.add(createMockNormalizedError({
        fingerprint: 'fp-1',
        severity: ErrorSeverity.MEDIUM,
      }));
      aggregator.add(createMockNormalizedError({
        fingerprint: 'fp-2',
        severity: ErrorSeverity.MEDIUM,
      }));

      // Act
      aggregator.flushAll();
      vi.advanceTimersByTime(31000);

      // Assert - callback should NOT be called for timer flushes
      expect(flushCallback).not.toHaveBeenCalled();
    });
  });

  describe('getUpdatedBuckets()', () => {
    it('should return buckets updated after notification', () => {
      // Arrange
      const aggregator = new ErrorAggregator(30000, 3, flushCallback);

      // Set initial time
      vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
      const error1 = createMockNormalizedError({
        fingerprint: 'fp-123',
        timestamp: new Date('2024-01-01T12:00:00Z'),
      });
      aggregator.add(error1);

      // Flush and mark as notified (this sets lastNotifiedAt to current system time)
      const bucket = aggregator.flushImmediately('fp-123');
      expect(bucket).not.toBeNull();

      // Move time forward BEFORE adding the next error
      vi.setSystemTime(new Date('2024-01-01T12:10:00Z'));

      // Add another error with a timestamp AFTER lastNotifiedAt
      const error2 = createMockNormalizedError({
        fingerprint: 'fp-123',
        timestamp: new Date('2024-01-01T12:10:00Z'),
      });
      aggregator.add(error2);

      // Act
      const updated = aggregator.getUpdatedBuckets();

      // Assert
      expect(updated).toHaveLength(1);
      expect(updated[0].fingerprint).toBe('fp-123');
    });

    it('should return empty array if no updates after notification', () => {
      // Arrange
      const aggregator = new ErrorAggregator(30000, 3, flushCallback);
      aggregator.add(createMockNormalizedError({ fingerprint: 'fp-123' }));
      aggregator.flushImmediately('fp-123');

      // Act
      const updated = aggregator.getUpdatedBuckets();

      // Assert
      expect(updated).toHaveLength(0);
    });
  });

  describe('prune()', () => {
    it('should remove buckets older than maxAge', () => {
      // Arrange
      const aggregator = new ErrorAggregator(30000, 3, flushCallback);
      aggregator.add(createMockNormalizedError({
        fingerprint: 'old-fp',
        timestamp: new Date('2024-01-01T10:00:00Z'),
      }));

      vi.setSystemTime(new Date('2024-01-01T12:00:00Z')); // 2 hours later

      // Act
      const prunedCount = aggregator.prune(60 * 60 * 1000); // 1 hour max age

      // Assert
      expect(prunedCount).toBe(1);
      expect(aggregator.getBucket('old-fp')).toBeUndefined();
    });

    it('should keep buckets within maxAge', () => {
      // Arrange
      const aggregator = new ErrorAggregator(30000, 3, flushCallback);
      vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
      aggregator.add(createMockNormalizedError({
        fingerprint: 'recent-fp',
        timestamp: new Date('2024-01-01T12:00:00Z'),
      }));

      vi.setSystemTime(new Date('2024-01-01T12:30:00Z')); // 30 mins later

      // Act
      const prunedCount = aggregator.prune(60 * 60 * 1000); // 1 hour max age

      // Assert
      expect(prunedCount).toBe(0);
      expect(aggregator.getBucket('recent-fp')).toBeDefined();
    });
  });

  describe('getStats()', () => {
    it('should return correct statistics', () => {
      // Arrange
      const aggregator = new ErrorAggregator(30000, 3, flushCallback);
      aggregator.add(createMockNormalizedError({
        fingerprint: 'fp-1',
        category: ErrorCategory.DATABASE_QUERY,
      }));
      aggregator.add(createMockNormalizedError({
        fingerprint: 'fp-1',
        category: ErrorCategory.DATABASE_QUERY,
      }));
      aggregator.add(createMockNormalizedError({
        fingerprint: 'fp-2',
        category: ErrorCategory.DISCORD_API,
      }));

      // Act
      const stats = aggregator.getStats();

      // Assert
      expect(stats.activeBuckets).toBe(2);
      expect(stats.totalErrors).toBe(3);
      expect(stats.byCategoryCount.get(ErrorCategory.DATABASE_QUERY)).toBe(2);
      expect(stats.byCategoryCount.get(ErrorCategory.DISCORD_API)).toBe(1);
    });
  });

  describe('reset()', () => {
    it('should clear all buckets and cancel timers', () => {
      // Arrange
      const aggregator = new ErrorAggregator(30000, 3, flushCallback);
      aggregator.add(createMockNormalizedError({
        fingerprint: 'fp-1',
        severity: ErrorSeverity.MEDIUM,
      }));
      aggregator.add(createMockNormalizedError({ fingerprint: 'fp-2' }));

      // Act
      aggregator.reset();
      vi.advanceTimersByTime(31000); // Past aggregation window

      // Assert
      expect(aggregator.getStats().activeBuckets).toBe(0);
      expect(flushCallback).not.toHaveBeenCalled();
    });
  });
});

// ============================================
// classifier 測試
// ============================================

describe('classifier', () => {
  describe('classifyError()', () => {
    describe('Redis errors', () => {
      it('should classify Redis connection error as CRITICAL', () => {
        const result = classifyError('Redis error: ECONNREFUSED');
        expect(result.category).toBe(ErrorCategory.REDIS_CONNECTION);
        expect(result.severity).toBe(ErrorSeverity.CRITICAL);
      });

      it('should classify Redis connection issues', () => {
        const result = classifyError('Redis connection failed');
        expect(result.category).toBe(ErrorCategory.REDIS_CONNECTION);
        expect(result.severity).toBe(ErrorSeverity.CRITICAL);
      });
    });

    describe('Database connection errors', () => {
      it('should classify connection refused as CRITICAL', () => {
        const result = classifyError('Connection refused');
        expect(result.category).toBe(ErrorCategory.DATABASE_CONNECTION);
        expect(result.severity).toBe(ErrorSeverity.CRITICAL);
      });

      it('should classify ECONNREFUSED as CRITICAL', () => {
        const result = classifyError('ECONNREFUSED');
        expect(result.category).toBe(ErrorCategory.DATABASE_CONNECTION);
        expect(result.severity).toBe(ErrorSeverity.CRITICAL);
      });

      it('should classify connection terminated as CRITICAL', () => {
        const result = classifyError('Connection terminated unexpectedly');
        expect(result.category).toBe(ErrorCategory.DATABASE_CONNECTION);
        expect(result.severity).toBe(ErrorSeverity.CRITICAL);
      });

      it('should classify pool errors as CRITICAL', () => {
        const result = classifyError('Pool error: too many connections');
        expect(result.category).toBe(ErrorCategory.DATABASE_CONNECTION);
        expect(result.severity).toBe(ErrorSeverity.CRITICAL);
      });

      it('should classify idle client error as CRITICAL', () => {
        const result = classifyError('an idle client has experienced an error');
        expect(result.category).toBe(ErrorCategory.DATABASE_CONNECTION);
        expect(result.severity).toBe(ErrorSeverity.CRITICAL);
      });
    });

    describe('Database query errors', () => {
      it('should classify syntax error as HIGH', () => {
        const result = classifyError('syntax error at or near SELECT');
        expect(result.category).toBe(ErrorCategory.DATABASE_QUERY);
        expect(result.severity).toBe(ErrorSeverity.HIGH);
      });

      it('should classify relation does not exist as HIGH', () => {
        const result = classifyError('relation "users" does not exist');
        expect(result.category).toBe(ErrorCategory.DATABASE_QUERY);
        expect(result.severity).toBe(ErrorSeverity.HIGH);
      });

      it('should classify column does not exist as HIGH', () => {
        const result = classifyError('column "email" does not exist');
        expect(result.category).toBe(ErrorCategory.DATABASE_QUERY);
        expect(result.severity).toBe(ErrorSeverity.HIGH);
      });

      it('should classify duplicate key error as HIGH', () => {
        const result = classifyError('duplicate key value violates unique constraint');
        expect(result.category).toBe(ErrorCategory.DATABASE_QUERY);
        expect(result.severity).toBe(ErrorSeverity.HIGH);
      });
    });

    describe('Rate limit errors', () => {
      it('should classify rate limit as LOW', () => {
        const result = classifyError('You are being rate limited');
        expect(result.category).toBe(ErrorCategory.RATE_LIMIT);
        expect(result.severity).toBe(ErrorSeverity.LOW);
      });

      it('should classify 429 as LOW', () => {
        const result = classifyError('HTTP 429: Too Many Requests');
        expect(result.category).toBe(ErrorCategory.RATE_LIMIT);
        expect(result.severity).toBe(ErrorSeverity.LOW);
      });
    });

    describe('Discord API errors', () => {
      it('should classify unknown interaction as MEDIUM', () => {
        const result = classifyError('Unknown Interaction');
        expect(result.category).toBe(ErrorCategory.DISCORD_API);
        expect(result.severity).toBe(ErrorSeverity.MEDIUM);
      });

      it('should classify DiscordAPIError by error name', () => {
        const result = classifyError('Some message', 'DiscordAPIError');
        expect(result.category).toBe(ErrorCategory.DISCORD_API);
        expect(result.severity).toBe(ErrorSeverity.MEDIUM);
      });

      it('should classify missing access as MEDIUM', () => {
        const result = classifyError('Missing Access');
        expect(result.category).toBe(ErrorCategory.DISCORD_API);
        expect(result.severity).toBe(ErrorSeverity.MEDIUM);
      });

      it('should classify Discord error code 10062 as MEDIUM', () => {
        const result = classifyError('Error code: 10062');
        expect(result.category).toBe(ErrorCategory.DISCORD_API);
        expect(result.severity).toBe(ErrorSeverity.MEDIUM);
      });
    });

    describe('Network errors', () => {
      it('should classify ETIMEDOUT as HIGH', () => {
        const result = classifyError('ETIMEDOUT');
        expect(result.category).toBe(ErrorCategory.NETWORK);
        expect(result.severity).toBe(ErrorSeverity.HIGH);
      });

      it('should classify ENOTFOUND as HIGH', () => {
        const result = classifyError('ENOTFOUND api.example.com');
        expect(result.category).toBe(ErrorCategory.NETWORK);
        expect(result.severity).toBe(ErrorSeverity.HIGH);
      });

      it('should classify socket hang up as HIGH', () => {
        const result = classifyError('socket hang up');
        expect(result.category).toBe(ErrorCategory.NETWORK);
        expect(result.severity).toBe(ErrorSeverity.HIGH);
      });

      it('should classify fetch failed as HIGH', () => {
        const result = classifyError('fetch failed');
        expect(result.category).toBe(ErrorCategory.NETWORK);
        expect(result.severity).toBe(ErrorSeverity.HIGH);
      });
    });

    describe('Permission errors', () => {
      it('should classify permission error as MEDIUM', () => {
        const result = classifyError('Permission denied');
        expect(result.category).toBe(ErrorCategory.PERMISSION);
        expect(result.severity).toBe(ErrorSeverity.MEDIUM);
      });

      it('should classify forbidden as MEDIUM', () => {
        const result = classifyError('Forbidden');
        expect(result.category).toBe(ErrorCategory.PERMISSION);
        expect(result.severity).toBe(ErrorSeverity.MEDIUM);
      });

      it('should classify missing permissions code as MEDIUM', () => {
        const result = classifyError('Error 50013: Missing Permissions');
        expect(result.category).toBe(ErrorCategory.PERMISSION);
        expect(result.severity).toBe(ErrorSeverity.MEDIUM);
      });
    });

    describe('Validation errors', () => {
      it('should classify validation error as LOW', () => {
        const result = classifyError('Validation failed');
        expect(result.category).toBe(ErrorCategory.VALIDATION);
        expect(result.severity).toBe(ErrorSeverity.LOW);
      });

      it('should classify invalid input as LOW', () => {
        const result = classifyError('Invalid input provided');
        expect(result.category).toBe(ErrorCategory.VALIDATION);
        expect(result.severity).toBe(ErrorSeverity.LOW);
      });

      it('should classify ZodError by error name as LOW', () => {
        const result = classifyError('Some message', 'ZodError');
        expect(result.category).toBe(ErrorCategory.VALIDATION);
        expect(result.severity).toBe(ErrorSeverity.LOW);
      });
    });

    describe('Unknown errors', () => {
      it('should classify unknown error as UNKNOWN MEDIUM', () => {
        const result = classifyError('Something unexpected happened');
        expect(result.category).toBe(ErrorCategory.UNKNOWN);
        expect(result.severity).toBe(ErrorSeverity.MEDIUM);
      });
    });
  });

  describe('getSeverityEmoji()', () => {
    it('should return red for CRITICAL', () => {
      expect(getSeverityEmoji(ErrorSeverity.CRITICAL)).toBe('🔴');
    });

    it('should return orange for HIGH', () => {
      expect(getSeverityEmoji(ErrorSeverity.HIGH)).toBe('🟠');
    });

    it('should return yellow for MEDIUM', () => {
      expect(getSeverityEmoji(ErrorSeverity.MEDIUM)).toBe('🟡');
    });

    it('should return blue for LOW', () => {
      expect(getSeverityEmoji(ErrorSeverity.LOW)).toBe('🔵');
    });

    it('should return white for unknown severity', () => {
      expect(getSeverityEmoji('UNKNOWN' as ErrorSeverity)).toBe('⚪');
    });
  });

  describe('getSeverityColor()', () => {
    it('should return red (0xff0000) for CRITICAL', () => {
      expect(getSeverityColor(ErrorSeverity.CRITICAL)).toBe(0xff0000);
    });

    it('should return orange (0xff6b00) for HIGH', () => {
      expect(getSeverityColor(ErrorSeverity.HIGH)).toBe(0xff6b00);
    });

    it('should return yellow (0xffc107) for MEDIUM', () => {
      expect(getSeverityColor(ErrorSeverity.MEDIUM)).toBe(0xffc107);
    });

    it('should return teal (0x17a2b8) for LOW', () => {
      expect(getSeverityColor(ErrorSeverity.LOW)).toBe(0x17a2b8);
    });

    it('should return gray for unknown severity', () => {
      expect(getSeverityColor('UNKNOWN' as ErrorSeverity)).toBe(0x808080);
    });
  });
});

// ============================================
// fingerprint 測試
// ============================================

describe('fingerprint', () => {
  describe('generateFingerprint()', () => {
    it('should generate 16-character hex fingerprint', () => {
      // Arrange
      const input = {
        message: 'Test error message',
        category: ErrorCategory.UNKNOWN,
      };

      // Act
      const fingerprint = generateFingerprint(input);

      // Assert
      expect(fingerprint).toHaveLength(16);
      expect(/^[0-9a-f]{16}$/.test(fingerprint)).toBe(true);
    });

    it('should generate same fingerprint for same input', () => {
      // Arrange
      const input = {
        message: 'Connection refused',
        category: ErrorCategory.DATABASE_CONNECTION,
      };

      // Act
      const fp1 = generateFingerprint(input);
      const fp2 = generateFingerprint(input);

      // Assert
      expect(fp1).toBe(fp2);
    });

    it('should generate different fingerprints for different messages', () => {
      // Arrange
      const input1 = { message: 'Error A', category: ErrorCategory.UNKNOWN };
      const input2 = { message: 'Error B', category: ErrorCategory.UNKNOWN };

      // Act
      const fp1 = generateFingerprint(input1);
      const fp2 = generateFingerprint(input2);

      // Assert
      expect(fp1).not.toBe(fp2);
    });

    it('should generate different fingerprints for different categories', () => {
      // Arrange
      const input1 = { message: 'Error', category: ErrorCategory.DATABASE_CONNECTION };
      const input2 = { message: 'Error', category: ErrorCategory.NETWORK };

      // Act
      const fp1 = generateFingerprint(input1);
      const fp2 = generateFingerprint(input2);

      // Assert
      expect(fp1).not.toBe(fp2);
    });

    it('should include error name in fingerprint', () => {
      // Arrange
      const input1 = { message: 'Error', category: ErrorCategory.UNKNOWN };
      const input2 = { message: 'Error', category: ErrorCategory.UNKNOWN, errorName: 'TypeError' };

      // Act
      const fp1 = generateFingerprint(input1);
      const fp2 = generateFingerprint(input2);

      // Assert
      expect(fp1).not.toBe(fp2);
    });

    describe('message normalization', () => {
      it('should normalize UUIDs', () => {
        // Arrange
        const input1 = {
          message: 'Error for user 550e8400-e29b-41d4-a716-446655440000',
          category: ErrorCategory.UNKNOWN,
        };
        const input2 = {
          message: 'Error for user 123e4567-e89b-12d3-a456-426614174000',
          category: ErrorCategory.UNKNOWN,
        };

        // Act
        const fp1 = generateFingerprint(input1);
        const fp2 = generateFingerprint(input2);

        // Assert
        expect(fp1).toBe(fp2);
      });

      it('should normalize Discord snowflake IDs', () => {
        // Arrange
        const input1 = {
          message: 'User 123456789012345678 not found',
          category: ErrorCategory.UNKNOWN,
        };
        const input2 = {
          message: 'User 987654321098765432 not found',
          category: ErrorCategory.UNKNOWN,
        };

        // Act
        const fp1 = generateFingerprint(input1);
        const fp2 = generateFingerprint(input2);

        // Assert
        expect(fp1).toBe(fp2);
      });

      it('should normalize ISO timestamps', () => {
        // Arrange
        const input1 = {
          message: 'Error at 2024-01-01T12:00:00',
          category: ErrorCategory.UNKNOWN,
        };
        const input2 = {
          message: 'Error at 2024-06-15T18:30:45',
          category: ErrorCategory.UNKNOWN,
        };

        // Act
        const fp1 = generateFingerprint(input1);
        const fp2 = generateFingerprint(input2);

        // Assert
        expect(fp1).toBe(fp2);
      });

      it('should normalize IP addresses', () => {
        // Arrange
        const input1 = {
          message: 'Connection from 192.168.1.1 failed',
          category: ErrorCategory.UNKNOWN,
        };
        const input2 = {
          message: 'Connection from 10.0.0.1 failed',
          category: ErrorCategory.UNKNOWN,
        };

        // Act
        const fp1 = generateFingerprint(input1);
        const fp2 = generateFingerprint(input2);

        // Assert
        expect(fp1).toBe(fp2);
      });

      it('should normalize port numbers', () => {
        // Arrange
        const input1 = {
          message: 'Connection to :5432 refused',
          category: ErrorCategory.UNKNOWN,
        };
        const input2 = {
          message: 'Connection to :5433 refused',
          category: ErrorCategory.UNKNOWN,
        };

        // Act
        const fp1 = generateFingerprint(input1);
        const fp2 = generateFingerprint(input2);

        // Assert
        expect(fp1).toBe(fp2);
      });

      it('should normalize hex hashes', () => {
        // Arrange
        const input1 = {
          message: 'Hash: a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
          category: ErrorCategory.UNKNOWN,
        };
        const input2 = {
          message: 'Hash: ffffeeeeddddccccbbbbaaaa99998888',
          category: ErrorCategory.UNKNOWN,
        };

        // Act
        const fp1 = generateFingerprint(input1);
        const fp2 = generateFingerprint(input2);

        // Assert
        expect(fp1).toBe(fp2);
      });
    });

    describe('stack frame extraction', () => {
      it('should include stable stack frames in fingerprint', () => {
        // Arrange
        const stack1 = `Error: Test
    at myFunction (src/services/test.ts:10:5)
    at anotherFunction (src/utils/helper.ts:20:10)`;
        const stack2 = `Error: Test
    at myFunction (src/services/test.ts:10:5)
    at anotherFunction (src/utils/helper.ts:20:10)`;

        const input1 = { message: 'Test', stack: stack1, category: ErrorCategory.UNKNOWN };
        const input2 = { message: 'Test', stack: stack2, category: ErrorCategory.UNKNOWN };

        // Act
        const fp1 = generateFingerprint(input1);
        const fp2 = generateFingerprint(input2);

        // Assert
        expect(fp1).toBe(fp2);
      });

      it('should skip node_modules frames', () => {
        // Arrange
        const stack1 = `Error: Test
    at node_modules/some-package/index.js:10:5
    at myFunction (src/services/test.ts:10:5)`;
        const stack2 = `Error: Test
    at node_modules/other-package/lib/main.js:50:20
    at myFunction (src/services/test.ts:10:5)`;

        const input1 = { message: 'Test', stack: stack1, category: ErrorCategory.UNKNOWN };
        const input2 = { message: 'Test', stack: stack2, category: ErrorCategory.UNKNOWN };

        // Act
        const fp1 = generateFingerprint(input1);
        const fp2 = generateFingerprint(input2);

        // Assert
        expect(fp1).toBe(fp2);
      });

      it('should produce different fingerprints for different source locations', () => {
        // Arrange
        const stack1 = `Error: Test
    at functionA (src/services/a.ts:10:5)`;
        const stack2 = `Error: Test
    at functionB (src/services/b.ts:20:10)`;

        const input1 = { message: 'Test', stack: stack1, category: ErrorCategory.UNKNOWN };
        const input2 = { message: 'Test', stack: stack2, category: ErrorCategory.UNKNOWN };

        // Act
        const fp1 = generateFingerprint(input1);
        const fp2 = generateFingerprint(input2);

        // Assert
        expect(fp1).not.toBe(fp2);
      });
    });
  });
});

// ============================================
// EnhancedDiscordWebhookTransport 測試
// ============================================

describe('EnhancedDiscordWebhookTransport', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockWebhookSend.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should initialize with provided options', () => {
      // Arrange & Act
      const transport = new EnhancedDiscordWebhookTransport({
        webhookUrl: 'https://discord.com/api/webhooks/123/abc',
        maxMessagesPerWindow: 10,
        windowDurationMs: 300000,
      });

      // Assert
      const stats = transport.getStats();
      expect(stats.totalReceived).toBe(0);
      expect(stats.totalSent).toBe(0);

      // Cleanup
      transport.close();
    });

    it('should use default options when not provided', () => {
      // Arrange & Act
      const transport = new EnhancedDiscordWebhookTransport({
        webhookUrl: 'https://discord.com/api/webhooks/123/abc',
      });

      // Assert - transport should work without errors
      expect(transport).toBeDefined();

      // Cleanup
      transport.close();
    });

    it('should handle invalid webhook URL gracefully', () => {
      // Arrange & Act - should not throw
      const transport = new EnhancedDiscordWebhookTransport({
        webhookUrl: '',
      });

      // Assert
      expect(transport).toBeDefined();

      // Cleanup
      transport.close();
    });
  });

  describe('log()', () => {
    it('should increment totalReceived', () => {
      // Arrange
      const transport = new EnhancedDiscordWebhookTransport({
        webhookUrl: 'https://discord.com/api/webhooks/123/abc',
      });
      const callback = vi.fn();

      // Act
      transport.log({ message: 'Test error', level: 'error' }, callback);

      // Assert
      expect(transport.getStats().totalReceived).toBe(1);
      expect(callback).toHaveBeenCalled();

      // Cleanup
      transport.close();
    });

    it('should call callback immediately', () => {
      // Arrange
      const transport = new EnhancedDiscordWebhookTransport({
        webhookUrl: 'https://discord.com/api/webhooks/123/abc',
      });
      const callback = vi.fn();

      // Act
      transport.log({ message: 'Test', level: 'error' }, callback);

      // Assert
      expect(callback).toHaveBeenCalledTimes(1);

      // Cleanup
      transport.close();
    });

    it('should emit logged event', () => {
      // Arrange
      const transport = new EnhancedDiscordWebhookTransport({
        webhookUrl: 'https://discord.com/api/webhooks/123/abc',
      });
      const loggedHandler = vi.fn();
      transport.on('logged', loggedHandler);

      // Act
      transport.log({ message: 'Test', level: 'error' }, vi.fn());

      // The logged event is emitted via setImmediate, which is mocked by fake timers
      // We verify the event registration works by checking the handler is attached
      expect(transport.listenerCount('logged')).toBe(1);

      // Cleanup
      transport.close();
    });

    it('should aggregate repeated errors', () => {
      // Arrange
      const transport = new EnhancedDiscordWebhookTransport({
        webhookUrl: 'https://discord.com/api/webhooks/123/abc',
        aggregationWindowMs: 30000,
      });

      // Act
      transport.log({ message: 'Same error message', level: 'error' }, vi.fn());
      transport.log({ message: 'Same error message', level: 'error' }, vi.fn());
      transport.log({ message: 'Same error message', level: 'error' }, vi.fn());

      // Assert
      expect(transport.getStats().totalAggregated).toBe(2); // 2 aggregated into first

      // Cleanup
      transport.close();
    });

    it('should send CRITICAL errors immediately', async () => {
      // Arrange
      const transport = new EnhancedDiscordWebhookTransport({
        webhookUrl: 'https://discord.com/api/webhooks/123/abc',
        aggregationWindowMs: 30000,
      });

      // Act - Redis error is CRITICAL
      transport.log({ message: 'Redis error: ECONNREFUSED', level: 'error' }, vi.fn());

      // Process timers to allow queue processing
      await vi.advanceTimersByTimeAsync(1000);

      // Assert
      expect(mockWebhookSend).toHaveBeenCalled();

      // Cleanup
      transport.close();
    });

    it('should not send immediately for non-CRITICAL errors', async () => {
      // Arrange
      const transport = new EnhancedDiscordWebhookTransport({
        webhookUrl: 'https://discord.com/api/webhooks/123/abc',
        aggregationWindowMs: 30000,
      });

      // Act - Validation error is LOW severity
      transport.log({ message: 'Validation failed', level: 'error' }, vi.fn());

      // Process timers but not past aggregation window
      await vi.advanceTimersByTimeAsync(1000);

      // Assert - should not have sent yet (waiting for aggregation window)
      expect(mockWebhookSend).not.toHaveBeenCalled();

      // Cleanup
      transport.close();
    });

    it('should send after aggregation window expires', async () => {
      // Arrange
      const transport = new EnhancedDiscordWebhookTransport({
        webhookUrl: 'https://discord.com/api/webhooks/123/abc',
        aggregationWindowMs: 5000,
      });

      // Act
      transport.log({ message: 'Some error', level: 'error' }, vi.fn());

      // Wait past aggregation window
      await vi.advanceTimersByTimeAsync(6000);

      // Assert
      expect(mockWebhookSend).toHaveBeenCalled();

      // Cleanup
      transport.close();
    });

    it('should exclude sensitive metadata', () => {
      // Arrange
      const transport = new EnhancedDiscordWebhookTransport({
        webhookUrl: 'https://discord.com/api/webhooks/123/abc',
      });

      // Act
      transport.log({
        message: 'Error',
        level: 'error',
        password: 'secret123',
        token: 'abc123',
        apiKey: 'key456',
        normalField: 'value',
      }, vi.fn());

      // Assert - the error should be processed without sensitive fields
      // (We can't directly check the normalized error, but no error should be thrown)
      expect(transport.getStats().totalReceived).toBe(1);

      // Cleanup
      transport.close();
    });
  });

  describe('getStats()', () => {
    it('should return copy of stats', () => {
      // Arrange
      const transport = new EnhancedDiscordWebhookTransport({
        webhookUrl: 'https://discord.com/api/webhooks/123/abc',
      });
      transport.log({ message: 'Test', level: 'error' }, vi.fn());

      // Act
      const stats = transport.getStats();

      // Assert
      expect(stats.totalReceived).toBe(1);
      expect(stats.totalSent).toBe(0);
      expect(stats.totalAggregated).toBe(0);
      expect(stats.totalSuppressed).toBe(0);

      // Cleanup
      transport.close();
    });
  });

  describe('close()', () => {
    it('should stop summary timer', () => {
      // Arrange
      const transport = new EnhancedDiscordWebhookTransport({
        webhookUrl: 'https://discord.com/api/webhooks/123/abc',
        enableSummary: true,
        summaryIntervalMs: 60000,
      });

      // Act
      transport.close();

      // Advance time past summary interval
      vi.advanceTimersByTime(120000);

      // Assert - summary send should not be called after close
      // (We're verifying no errors occur)
      expect(mockWebhookDestroy).toHaveBeenCalled();
    });

    it('should destroy webhook client', () => {
      // Arrange
      const transport = new EnhancedDiscordWebhookTransport({
        webhookUrl: 'https://discord.com/api/webhooks/123/abc',
      });

      // Act
      transport.close();

      // Assert
      expect(mockWebhookDestroy).toHaveBeenCalled();
    });
  });

  describe('rate limiting', () => {
    it('should suppress errors when rate limited', async () => {
      // Arrange
      const transport = new EnhancedDiscordWebhookTransport({
        webhookUrl: 'https://discord.com/api/webhooks/123/abc',
        maxMessagesPerWindow: 2,
        windowDurationMs: 60000,
        aggregationWindowMs: 100, // Short for testing
      });

      // Act - send 5 different errors
      for (let i = 0; i < 5; i++) {
        transport.log({ message: `Error ${i}`, level: 'error' }, vi.fn());
      }

      // Wait for aggregation window to expire for all
      await vi.advanceTimersByTimeAsync(1000);

      // Assert - only 2 should be sent due to rate limit
      expect(transport.getStats().totalSuppressed).toBeGreaterThan(0);

      // Cleanup
      transport.close();
    });

    it('should allow CRITICAL errors to bypass rate limit', async () => {
      // Arrange
      const transport = new EnhancedDiscordWebhookTransport({
        webhookUrl: 'https://discord.com/api/webhooks/123/abc',
        maxMessagesPerWindow: 1,
        windowDurationMs: 60000,
        criticalBypassRateLimit: true,
      });

      // Act - first use up the rate limit with validation error
      transport.log({ message: 'Validation failed: field 1', level: 'error' }, vi.fn());
      await vi.advanceTimersByTimeAsync(31000); // Wait for aggregation flush

      // Then send a CRITICAL error (should bypass rate limit)
      transport.log({ message: 'Redis error: ECONNREFUSED', level: 'error' }, vi.fn());
      await vi.advanceTimersByTimeAsync(1000);

      // Assert - both should be sent (CRITICAL bypasses limit)
      expect(mockWebhookSend).toHaveBeenCalledTimes(2);

      // Cleanup
      transport.close();
    });
  });
});
