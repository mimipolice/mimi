import { ErrorCategory, ErrorSeverity } from "./types";

interface ClassificationResult {
  category: ErrorCategory;
  severity: ErrorSeverity;
}

/**
 * Classify an error based on its message and characteristics.
 * Returns both the category and severity level for proper handling.
 */
export function classifyError(
  message: string,
  errorName?: string,
  meta?: Record<string, unknown>
): ClassificationResult {
  const lowerMessage = message.toLowerCase();
  const lowerName = (errorName || "").toLowerCase();

  // Redis connection errors (CRITICAL) - check BEFORE database to avoid ECONNREFUSED confusion
  if (
    lowerMessage.includes("redis") &&
    (lowerMessage.includes("error") ||
      lowerMessage.includes("connection") ||
      lowerMessage.includes("econnrefused"))
  ) {
    return {
      category: ErrorCategory.REDIS_CONNECTION,
      severity: ErrorSeverity.CRITICAL,
    };
  }

  // Database connection errors (CRITICAL) - immediate notification needed
  if (
    lowerMessage.includes("connection refused") ||
    lowerMessage.includes("econnrefused") ||
    lowerMessage.includes("connection terminated") ||
    lowerMessage.includes("connection reset") ||
    (lowerMessage.includes("etimedout") && lowerMessage.includes("postgres")) ||
    (lowerMessage.includes("pool") && lowerMessage.includes("error")) ||
    lowerMessage.includes("an idle client has experienced an error") ||
    lowerName.includes("connectionerror")
  ) {
    return {
      category: ErrorCategory.DATABASE_CONNECTION,
      severity: ErrorSeverity.CRITICAL,
    };
  }

  // Database query errors (HIGH)
  if (
    lowerMessage.includes("syntax error") ||
    (lowerMessage.includes("relation") && lowerMessage.includes("does not exist")) ||
    (lowerMessage.includes("column") && lowerMessage.includes("does not exist")) ||
    lowerMessage.includes("duplicate key") ||
    lowerMessage.includes("violates") ||
    lowerName.includes("queryerror") ||
    lowerName.includes("databaseerror")
  ) {
    return {
      category: ErrorCategory.DATABASE_QUERY,
      severity: ErrorSeverity.HIGH,
    };
  }

  // Discord API Rate Limits (LOW) - expected behavior
  if (
    lowerMessage.includes("rate limit") ||
    lowerMessage.includes("429") ||
    lowerMessage.includes("you are being rate limited")
  ) {
    return {
      category: ErrorCategory.RATE_LIMIT,
      severity: ErrorSeverity.LOW,
    };
  }

  // Discord API errors (MEDIUM)
  if (
    lowerName.includes("discordapierror") ||
    lowerMessage.includes("unknown interaction") ||
    lowerMessage.includes("interaction has already been acknowledged") ||
    lowerMessage.includes("invalid form body") ||
    lowerMessage.includes("unknown message") ||
    lowerMessage.includes("unknown channel") ||
    lowerMessage.includes("missing access") ||
    lowerMessage.includes("50001") || // Missing Access
    lowerMessage.includes("10008") || // Unknown Message
    lowerMessage.includes("10062")    // Unknown Interaction
  ) {
    return {
      category: ErrorCategory.DISCORD_API,
      severity: ErrorSeverity.MEDIUM,
    };
  }

  // Network errors (HIGH)
  if (
    lowerMessage.includes("etimedout") ||
    lowerMessage.includes("enotfound") ||
    lowerMessage.includes("socket hang up") ||
    lowerMessage.includes("network") ||
    lowerMessage.includes("econnreset") ||
    lowerMessage.includes("fetch failed")
  ) {
    return {
      category: ErrorCategory.NETWORK,
      severity: ErrorSeverity.HIGH,
    };
  }

  // Permission errors (MEDIUM)
  if (
    lowerMessage.includes("permission") ||
    lowerMessage.includes("forbidden") ||
    lowerMessage.includes("50013") || // Discord Missing Permissions
    lowerMessage.includes("missing permissions")
  ) {
    return {
      category: ErrorCategory.PERMISSION,
      severity: ErrorSeverity.MEDIUM,
    };
  }

  // Validation errors (LOW)
  if (
    lowerMessage.includes("validation") ||
    lowerMessage.includes("invalid") ||
    lowerName.includes("validationerror") ||
    lowerName.includes("zoderror")
  ) {
    return {
      category: ErrorCategory.VALIDATION,
      severity: ErrorSeverity.LOW,
    };
  }

  // Default: Unknown (MEDIUM)
  return {
    category: ErrorCategory.UNKNOWN,
    severity: ErrorSeverity.MEDIUM,
  };
}

/**
 * Get a human-readable emoji for the severity level
 */
export function getSeverityEmoji(severity: ErrorSeverity): string {
  switch (severity) {
    case ErrorSeverity.CRITICAL:
      return "🔴";
    case ErrorSeverity.HIGH:
      return "🟠";
    case ErrorSeverity.MEDIUM:
      return "🟡";
    case ErrorSeverity.LOW:
      return "🔵";
    default:
      return "⚪";
  }
}

/**
 * Get the Discord embed color for the severity level
 */
export function getSeverityColor(severity: ErrorSeverity): number {
  switch (severity) {
    case ErrorSeverity.CRITICAL:
      return 0xff0000; // Red
    case ErrorSeverity.HIGH:
      return 0xff6b00; // Orange
    case ErrorSeverity.MEDIUM:
      return 0xffc107; // Yellow
    case ErrorSeverity.LOW:
      return 0x17a2b8; // Teal
    default:
      return 0x808080; // Gray
  }
}
