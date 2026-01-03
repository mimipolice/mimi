/**
 * Test script for Enhanced Discord Webhook Transport
 *
 * Usage: npx ts-node tests/discordWebhookTransport.test.ts
 *
 * This script tests:
 * 1. Fingerprint generation and deduplication
 * 2. Error classification
 * 3. Rate limiter behavior
 * 4. Aggregator functionality
 */

import { generateFingerprint } from "../src/utils/discordWebhookTransport/fingerprint";
import { classifyError, getSeverityEmoji } from "../src/utils/discordWebhookTransport/classifier";
import { SlidingWindowRateLimiter } from "../src/utils/discordWebhookTransport/rateLimiter";
import { ErrorAggregator } from "../src/utils/discordWebhookTransport/aggregator";
import { ErrorCategory, ErrorSeverity, NormalizedError } from "../src/utils/discordWebhookTransport/types";

// ANSI colors for console output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
};

function log(message: string, color: keyof typeof colors = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function assert(condition: boolean, message: string): void {
  if (condition) {
    log(`  ✓ ${message}`, "green");
  } else {
    log(`  ✗ ${message}`, "red");
    process.exitCode = 1;
  }
}

function section(title: string): void {
  console.log();
  log(`━━━ ${title} ━━━`, "cyan");
}

// ============================================
// Test 1: Fingerprint Generation
// ============================================
section("1. Fingerprint Generation");

// Same error message should produce same fingerprint
const fp1 = generateFingerprint({
  message: "Connection refused to database",
  category: ErrorCategory.DATABASE_CONNECTION,
});
const fp2 = generateFingerprint({
  message: "Connection refused to database",
  category: ErrorCategory.DATABASE_CONNECTION,
});
assert(fp1 === fp2, "Same message produces same fingerprint");

// Different messages should produce different fingerprints
const fp3 = generateFingerprint({
  message: "Connection timeout",
  category: ErrorCategory.DATABASE_CONNECTION,
});
assert(fp1 !== fp3, "Different messages produce different fingerprints");

// Variable parts should be normalized (snowflake IDs)
const fpWithId1 = generateFingerprint({
  message: "User 123456789012345678 not found",
  category: ErrorCategory.UNKNOWN,
});
const fpWithId2 = generateFingerprint({
  message: "User 987654321098765432 not found",
  category: ErrorCategory.UNKNOWN,
});
assert(fpWithId1 === fpWithId2, "Snowflake IDs are normalized (same fingerprint)");

// UUIDs should be normalized
const fpWithUuid1 = generateFingerprint({
  message: "Session a1b2c3d4-e5f6-7890-abcd-ef1234567890 expired",
  category: ErrorCategory.UNKNOWN,
});
const fpWithUuid2 = generateFingerprint({
  message: "Session 12345678-1234-1234-1234-123456789abc expired",
  category: ErrorCategory.UNKNOWN,
});
assert(fpWithUuid1 === fpWithUuid2, "UUIDs are normalized (same fingerprint)");

log(`  Example fingerprint: ${fp1}`, "dim");

// ============================================
// Test 2: Error Classification
// ============================================
section("2. Error Classification");

const dbConnError = classifyError("Connection refused to database at 192.168.1.1:5432");
assert(
  dbConnError.category === ErrorCategory.DATABASE_CONNECTION,
  `DB connection error classified as DATABASE_CONNECTION`
);
assert(
  dbConnError.severity === ErrorSeverity.CRITICAL,
  `DB connection error is CRITICAL severity`
);

const redisError = classifyError("Redis connection error: ECONNREFUSED");
assert(
  redisError.category === ErrorCategory.REDIS_CONNECTION,
  `Redis error classified as REDIS_CONNECTION`
);

const rateLimitError = classifyError("You are being rate limited");
assert(
  rateLimitError.category === ErrorCategory.RATE_LIMIT,
  `Rate limit classified as RATE_LIMIT`
);
assert(
  rateLimitError.severity === ErrorSeverity.LOW,
  `Rate limit is LOW severity`
);

const unknownError = classifyError("Something unexpected happened");
assert(
  unknownError.category === ErrorCategory.UNKNOWN,
  `Unknown error classified as UNKNOWN`
);

log(`  Severity emoji examples: ${getSeverityEmoji(ErrorSeverity.CRITICAL)} CRITICAL, ${getSeverityEmoji(ErrorSeverity.LOW)} LOW`, "dim");

// ============================================
// Test 3: Rate Limiter
// ============================================
section("3. Sliding Window Rate Limiter");

const rateLimiter = new SlidingWindowRateLimiter(1000, 3); // 1 second window, 3 max

// Should allow first 3 messages
assert(rateLimiter.tryAcquire() === true, "First message allowed");
assert(rateLimiter.tryAcquire() === true, "Second message allowed");
assert(rateLimiter.tryAcquire() === true, "Third message allowed");
assert(rateLimiter.tryAcquire() === false, "Fourth message blocked (rate limited)");

const stats = rateLimiter.getStats();
assert(stats.used === 3, `Stats show 3 used slots`);
assert(stats.max === 3, `Stats show 3 max slots`);

// Force acquire should always work
rateLimiter.forceAcquire();
const statsAfterForce = rateLimiter.getStats();
assert(statsAfterForce.used === 4, "Force acquire bypasses limit");

// Reset should clear all
rateLimiter.reset();
assert(rateLimiter.getRemainingQuota() === 3, "Reset clears all slots");

// ============================================
// Test 4: Error Aggregator
// ============================================
section("4. Error Aggregator");

let flushedBuckets: any[] = [];
const aggregator = new ErrorAggregator(100, 3, (bucket) => {
  flushedBuckets.push(bucket);
});

function createMockError(fingerprint: string, severity: ErrorSeverity = ErrorSeverity.MEDIUM): NormalizedError {
  return {
    fingerprint,
    category: ErrorCategory.UNKNOWN,
    severity,
    message: `Test error ${fingerprint}`,
    stackTrace: null,
    source: null,
    metadata: {},
    timestamp: new Date(),
  };
}

// Adding first error should return true (new bucket)
const isNew1 = aggregator.add(createMockError("fp-001"));
assert(isNew1 === true, "First error creates new bucket");

// Adding same error should return false (existing bucket)
const isNew2 = aggregator.add(createMockError("fp-001"));
assert(isNew2 === false, "Same fingerprint adds to existing bucket");

// Check bucket count
const bucket = aggregator.getBucket("fp-001");
assert(bucket?.count === 2, "Bucket count is 2 after adding same error twice");

// Adding different error should create new bucket
const isNew3 = aggregator.add(createMockError("fp-002"));
assert(isNew3 === true, "Different fingerprint creates new bucket");

// Test CRITICAL immediate flush
flushedBuckets = [];
const criticalError = createMockError("fp-critical", ErrorSeverity.CRITICAL);
aggregator.add(criticalError);
const criticalBucket = aggregator.flushImmediately("fp-critical");
assert(criticalBucket !== null, "CRITICAL error can be flushed immediately");
assert(criticalBucket?.severity === ErrorSeverity.CRITICAL, "Flushed bucket has CRITICAL severity");

// Test stats
const aggStats = aggregator.getStats();
assert(aggStats.activeBuckets >= 2, `Aggregator has ${aggStats.activeBuckets} active buckets`);
assert(aggStats.totalErrors >= 3, `Aggregator tracked ${aggStats.totalErrors} total errors`);

// Cleanup
aggregator.reset();

// ============================================
// Test 5: Integration Scenario
// ============================================
section("5. Integration Scenario (Simulated DB Outage)");

log("  Simulating 50 identical DB connection errors...", "dim");

const intRateLimiter = new SlidingWindowRateLimiter(60000, 15); // 1 min, 15 max
let sentCount = 0;
let suppressedCount = 0;

const intAggregator = new ErrorAggregator(100, 3, (bucket) => {
  // Try to send
  if (bucket.severity === ErrorSeverity.CRITICAL || intRateLimiter.tryAcquire()) {
    sentCount++;
    log(`    → Sent: ${getSeverityEmoji(bucket.severity)} ${bucket.category} (x${bucket.count})`, "dim");
  } else {
    suppressedCount += bucket.count;
  }
});

// Simulate 50 DB connection errors
for (let i = 0; i < 50; i++) {
  const error: NormalizedError = {
    fingerprint: generateFingerprint({
      message: "Connection refused to database",
      category: ErrorCategory.DATABASE_CONNECTION,
    }),
    category: ErrorCategory.DATABASE_CONNECTION,
    severity: ErrorSeverity.CRITICAL,
    message: "Connection refused to database",
    stackTrace: "at connectToPool (src/shared/database/index.ts:42)",
    source: "src/shared/database/index.ts",
    metadata: {},
    timestamp: new Date(),
  };

  const isFirst = intAggregator.add(error);

  // For CRITICAL, flush immediately on first occurrence
  if (error.severity === ErrorSeverity.CRITICAL && isFirst) {
    const bucket = intAggregator.flushImmediately(error.fingerprint);
    if (bucket) {
      if (intRateLimiter.tryAcquire()) {
        sentCount++;
        log(`    → Sent: ${getSeverityEmoji(bucket.severity)} ${bucket.category} (x${bucket.count})`, "dim");
      }
    }
  }
}

// Flush remaining
const remaining = intAggregator.flushAll();
for (const bucket of remaining) {
  if (intRateLimiter.tryAcquire()) {
    sentCount++;
    log(`    → Sent remaining: ${getSeverityEmoji(bucket.severity)} ${bucket.category} (x${bucket.count})`, "dim");
  } else {
    suppressedCount += bucket.count;
  }
}

log(`  Results: ${sentCount} messages sent, ${suppressedCount} errors suppressed`, "yellow");
assert(sentCount <= 15, `Sent messages (${sentCount}) within rate limit (15)`);
assert(sentCount >= 1, "At least 1 message was sent (CRITICAL)");

// ============================================
// Summary
// ============================================
section("Test Summary");

if (process.exitCode === 1) {
  log("Some tests failed!", "red");
} else {
  log("All tests passed! ✓", "green");
}

console.log();
