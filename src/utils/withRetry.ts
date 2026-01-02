import retry from "async-retry";
import logger from "./logger";

export interface RetryOptions {
  retries?: number;
  minTimeout?: number;
  factor?: number;
}

/**
 * Wraps an async function with retry logic.
 * @param fn - The async function to execute
 * @param context - A description of the operation for logging
 * @param options - Retry configuration options
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  context: string,
  options: RetryOptions = {}
): Promise<T> {
  return retry(async () => fn(), {
    retries: options.retries ?? 3,
    factor: options.factor ?? 2,
    minTimeout: options.minTimeout ?? 200,
    onRetry: (error: Error, attempt: number) => {
      logger.warn(
        `[Retry] ${context} failed on attempt ${attempt}. Retrying...`,
        { error: error.message }
      );
    },
  });
}
