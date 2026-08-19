/**
 * In-process sliding-window rate limiter. Good enough for a single-instance
 * deployment; the interface is intentionally tiny so it can be swapped for
 * a Redis-backed limiter (e.g. `@upstash/ratelimit`) once the app runs on
 * more than one instance without touching any call site.
 */
interface Bucket {
  timestamps: number[];
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);

  if (bucket.timestamps.length >= limit) {
    const oldest = bucket.timestamps[0];
    buckets.set(key, bucket);
    return { allowed: false, remaining: 0, retryAfterMs: windowMs - (now - oldest) };
  }

  bucket.timestamps.push(now);
  buckets.set(key, bucket);
  return { allowed: true, remaining: limit - bucket.timestamps.length, retryAfterMs: 0 };
}

/** Prevents accidental runaway/infinite generation loops from one user. */
export function checkGenerationBurstLimit(userId: string): RateLimitResult {
  return checkRateLimit(`generation:${userId}`, 5, 60_000); // 5 per minute
}
