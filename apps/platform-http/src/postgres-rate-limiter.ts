import { createHash } from 'node:crypto';
import type { RateLimiter, RateLimitDecision } from '@rntme/bindings-http';

type Queryable = {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    values?: readonly unknown[],
  ): Promise<{ rows: T[] }>;
};

export class PostgresRateLimiter implements RateLimiter {
  private lastCleanupMs = 0;

  constructor(private readonly opts: { db: Queryable; windowMs: number; max: number }) {}

  async check(key: string): Promise<RateLimitDecision> {
    const now = Date.now();
    if (now - this.lastCleanupMs >= this.opts.windowMs) {
      this.lastCleanupMs = now;
      await this.opts.db.query(
        `DELETE FROM platform_rate_limit WHERE expires_at < $1`,
        [new Date(now)],
      );
    }

    const bucketKeyHash = createHash('sha256').update(key).digest();
    const windowStartMs = Math.floor(now / this.opts.windowMs) * this.opts.windowMs;
    const windowStart = new Date(windowStartMs);
    const resetAtMs = windowStartMs + this.opts.windowMs;
    const expiresAt = new Date(resetAtMs);
    const result = await this.opts.db.query<{ count: number }>(
      `INSERT INTO platform_rate_limit (bucket_key_hash, window_start, count, expires_at)
       VALUES ($1, $2, 1, $3)
       ON CONFLICT (bucket_key_hash, window_start)
       DO UPDATE SET count = platform_rate_limit.count + 1, expires_at = EXCLUDED.expires_at
       RETURNING count`,
      [bucketKeyHash, windowStart, expiresAt],
    );
    const count = Number(result.rows[0]?.count ?? 0);
    const remaining = Math.max(0, this.opts.max - count);
    return {
      allowed: count <= this.opts.max,
      limit: this.opts.max,
      remaining,
      resetAtSeconds: Math.ceil(resetAtMs / 1000),
      retryAfterSeconds: Math.max(1, Math.ceil((resetAtMs - now) / 1000)),
    };
  }
}
