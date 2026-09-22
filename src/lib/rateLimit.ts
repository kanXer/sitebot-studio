/**
 * Lightweight in-memory sliding-window rate limiter, keyed by an arbitrary
 * string (typically `ip|botId`). Suitable for single-instance deployments.
 */

interface WindowBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, WindowBucket>();
const MAX_BUCKETS = 20000;

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterMs: number;
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const safeLimit = Math.max(1, Math.floor(Number(limit) || 20));
  const safeWindow = Math.max(1000, Math.floor(Number(windowMs) || 60000));

  const now = Date.now();

  if (buckets.size > MAX_BUCKETS) {
    for (const [k, b] of buckets) {
      if (b.resetAt <= now) {
        buckets.delete(k);
      }
    }
    if (buckets.size > MAX_BUCKETS) {
      buckets.clear();
    }
  }

  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + safeWindow };
    buckets.set(key, bucket);
  }

  if (bucket.count >= safeLimit) {
    return {
      allowed: false,
      limit: safeLimit,
      remaining: 0,
      retryAfterMs: Math.max(0, bucket.resetAt - now),
    };
  }

  bucket.count++;
  return {
    allowed: true,
    limit: safeLimit,
    remaining: Math.max(0, safeLimit - bucket.count),
    retryAfterMs: 0,
  };
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim() || 'unknown';
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return req.headers.get('host') || 'unknown';
}