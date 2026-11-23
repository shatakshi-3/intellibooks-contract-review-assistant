/**
 * Rate limiter using in-memory sliding window.
 *
 * Suitable for Vercel serverless — each function instance
 * maintains its own window. This provides basic per-instance
 * protection; for distributed rate limiting, use Vercel KV
 * or Upstash Redis.
 *
 * Limits are per-user to prevent abuse while allowing
 * legitimate multi-user concurrency.
 */

interface RateLimitEntry {
  timestamps: number[];
}

interface RateLimitConfig {
  windowMs: number;    // Time window in milliseconds
  maxRequests: number; // Max requests per window
}

export const RATE_LIMITS = {
  upload: { windowMs: 60_000, maxRequests: 10 },     // 10 uploads/min
  review: { windowMs: 60_000, maxRequests: 5 },      // 5 reviews/min
  chat: { windowMs: 60_000, maxRequests: 20 },       // 20 messages/min
  general: { windowMs: 60_000, maxRequests: 60 },    // 60 requests/min
} as const satisfies Record<string, RateLimitConfig>;

export type RateLimitType = keyof typeof RATE_LIMITS;

// In-memory store — resets on cold start (acceptable for serverless)
const store = new Map<string, RateLimitEntry>();

// Clean up old entries periodically to prevent memory leaks
const CLEANUP_INTERVAL = 5 * 60_000; // 5 minutes
let lastCleanup = Date.now();

function cleanup(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  const cutoff = now - Math.max(...Object.values(RATE_LIMITS).map((r) => r.windowMs));
  for (const [key, entry] of store.entries()) {
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
    if (entry.timestamps.length === 0) {
      store.delete(key);
    }
  }
}

/**
 * Check if a request should be rate limited.
 *
 * @returns Object with `limited` boolean and remaining count.
 */
export function checkRateLimit(
  userId: string,
  type: RateLimitType
): { limited: boolean; remaining: number; resetMs: number } {
  cleanup();

  const config = RATE_LIMITS[type];
  const key = `${type}:${userId}`;
  const now = Date.now();
  const windowStart = now - config.windowMs;

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

  if (entry.timestamps.length >= config.maxRequests) {
    const oldestInWindow = entry.timestamps[0];
    const resetMs = oldestInWindow + config.windowMs - now;
    return {
      limited: true,
      remaining: 0,
      resetMs: Math.max(0, resetMs),
    };
  }

  // Record this request
  entry.timestamps.push(now);

  return {
    limited: false,
    remaining: config.maxRequests - entry.timestamps.length,
    resetMs: 0,
  };
}
