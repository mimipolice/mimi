import crypto from "crypto";
import { ErrorCategory } from "./types";

interface FingerprintInput {
  message: string;
  stack?: string;
  errorName?: string;
  category: ErrorCategory;
}

/**
 * Generate a fingerprint for error grouping.
 *
 * Strategy:
 * 1. Extract the "core" of the error message (remove variable parts like IDs, timestamps)
 * 2. Extract the first 2-3 stack frames (stable location, excluding node_modules)
 * 3. Include error category
 * 4. Hash the combination
 */
export function generateFingerprint(input: FingerprintInput): string {
  const components: string[] = [];

  // 1. Normalize the error message
  const normalizedMessage = normalizeMessage(input.message);
  components.push(normalizedMessage);

  // 2. Extract stable stack frames
  if (input.stack) {
    const stableFrames = extractStableStackFrames(input.stack, 3);
    if (stableFrames) {
      components.push(stableFrames);
    }
  }

  // 3. Add error name if available
  if (input.errorName) {
    components.push(input.errorName.toLowerCase());
  }

  // 4. Add category
  components.push(input.category);

  // 5. Create hash
  const hashInput = components.join("|||");
  return crypto.createHash("sha256").update(hashInput).digest("hex").substring(0, 16);
}

/**
 * Normalize error message by removing variable parts:
 * - UUIDs, IDs, timestamps
 * - IP addresses and ports
 * - Discord snowflake IDs
 */
function normalizeMessage(message: string): string {
  return (
    message
      // Remove UUIDs (8-4-4-4-12 format)
      .replace(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        "<UUID>"
      )
      // Remove Discord snowflake IDs (17-19 digit numbers)
      .replace(/\b\d{17,19}\b/g, "<SNOWFLAKE>")
      // Remove ISO timestamps (2024-01-01T12:00:00 or 2024-01-01 12:00:00)
      .replace(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/g, "<TIMESTAMP>")
      // Remove IP addresses
      .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, "<IP>")
      // Remove port numbers after colon
      .replace(/:(\d{2,5})\b/g, ":<PORT>")
      // Remove generic numeric IDs in common patterns
      .replace(/\bid[=:]\s*\d+/gi, "id=<ID>")
      // Remove hex strings that look like hashes (32+ chars)
      .replace(/\b[0-9a-f]{32,}\b/gi, "<HASH>")
      // Normalize whitespace
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase()
  );
}

/**
 * Extract stable stack frames (file paths and line info)
 * Focus on internal project files, not node_modules
 */
function extractStableStackFrames(
  stack: string,
  maxFrames: number
): string | null {
  const lines = stack.split("\n");
  const frames: string[] = [];

  for (const line of lines) {
    if (frames.length >= maxFrames) break;

    // Match stack frame pattern: "at functionName (file:line:col)" or "at file:line:col"
    const match = line.match(/at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?/);
    if (match) {
      const [, funcName, filePath, lineNum] = match;

      // Skip node_modules frames for stability
      if (filePath.includes("node_modules")) continue;

      // Skip internal Node.js frames
      if (filePath.startsWith("node:")) continue;

      // Extract relative path from project root (keep src/ prefix)
      const relativePath = filePath.replace(/.*\/src\//, "src/");

      // Use function name or 'anonymous', plus location
      const frameId = `${funcName || "anonymous"}@${relativePath}:${lineNum}`;
      frames.push(frameId);
    }
  }

  return frames.length > 0 ? frames.join("->") : null;
}
