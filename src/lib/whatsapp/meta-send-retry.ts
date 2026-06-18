/**
 * Shared Meta Cloud API send retry for transient rate limits.
 * Used by broadcasts and the flows engine.
 */

export function isMetaRateLimitError(message: string): boolean {
  return /rate limit|\(#4\)|\(#80007\)/i.test(message);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry `fn` when Meta returns a rate-limit error. Other errors
 * propagate immediately.
 */
export async function withMetaRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (!isMetaRateLimitError(msg) || attempt >= maxAttempts - 1) {
        throw err;
      }
      await sleep(1000 * (attempt + 1));
    }
  }
  throw lastError;
}
