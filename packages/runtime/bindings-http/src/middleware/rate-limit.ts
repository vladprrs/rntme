import type { MiddlewareHandler } from 'hono';

export type RateLimitDecision = {
  readonly allowed: boolean;
  readonly limit: number;
  readonly remaining: number;
  /** Unix seconds at which the bucket resets. */
  readonly resetAtSeconds: number;
  /** Seconds until the bucket resets. Always >= 1 when blocked. */
  readonly retryAfterSeconds: number;
};

export interface RateLimiter {
  check(key: string): boolean | RateLimitDecision | Promise<boolean | RateLimitDecision>;
}

export class InMemoryRateLimiter implements RateLimiter {
  private readonly buckets = new Map<string, { count: number; resetAtMs: number }>();
  constructor(private readonly opts: { windowMs: number; max: number }) {}

  check(key: string): RateLimitDecision {
    const now = Date.now();
    for (const [bucketKey, bucket] of this.buckets) {
      if (bucket.resetAtMs <= now) this.buckets.delete(bucketKey);
    }
    let entry = this.buckets.get(key);
    if (entry === undefined || entry.resetAtMs <= now) {
      entry = { count: 0, resetAtMs: now + this.opts.windowMs };
      this.buckets.set(key, entry);
    }
    entry.count += 1;
    const remaining = Math.max(0, this.opts.max - entry.count);
    const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAtMs - now) / 1000));
    return {
      allowed: entry.count <= this.opts.max,
      limit: this.opts.max,
      remaining,
      resetAtSeconds: Math.ceil(entry.resetAtMs / 1000),
      retryAfterSeconds,
    };
  }
}

export type RateLimitOptions = {
  code?: string;
};

function isDecision(value: boolean | RateLimitDecision): value is RateLimitDecision {
  return typeof value === 'object' && value !== null && 'allowed' in value;
}

export function rateLimit(
  limiter: RateLimiter,
  keyFn: (c: Parameters<MiddlewareHandler>[0]) => string,
  opts: RateLimitOptions = {},
): MiddlewareHandler {
  const code = opts.code ?? 'RATE_LIMITED';
  return async (c, next) => {
    const key = keyFn(c);
    const result = await limiter.check(key);
    if (isDecision(result)) {
      c.header('X-RateLimit-Limit', String(result.limit));
      c.header('X-RateLimit-Remaining', String(result.remaining));
      c.header('X-RateLimit-Reset', String(result.resetAtSeconds));
      if (!result.allowed) {
        c.header('Retry-After', String(result.retryAfterSeconds));
        return c.json({ error: { code, message: 'rate limit exceeded' } }, 429);
      }
      await next();
      return;
    }
    if (result === false) {
      return c.json({ error: { code, message: 'rate limit exceeded' } }, 429);
    }
    await next();
  };
}
