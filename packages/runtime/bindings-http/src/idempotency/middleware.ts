import type { MiddlewareHandler } from 'hono';
import type { IdempotencyCache } from './cache.js';
import { deriveOperationRunId } from './derive-keys.js';

export type IdempotencyContext = {
  /** The raw client-provided Idempotency-Key header, or null if absent. */
  clientKey: string | null;
  /** Stable run-id derived from (operationName, clientKey). Null iff clientKey null. */
  runId: string | null;
};

export function idempotencyMiddleware(opts: {
  cache: IdempotencyCache;
  now: () => number;
  /** Caller provides the operation name from the binding plan; middleware is generic. */
  operationNameFromPath: (path: string) => string | null;
}): MiddlewareHandler<{ Variables: { idempotency: IdempotencyContext } }> {
  return async (c, next) => {
    const clientKey = c.req.header('Idempotency-Key') ?? null;
    let runId: string | null = null;
    if (clientKey !== null) {
      const operationName = opts.operationNameFromPath(new URL(c.req.url).pathname);
      if (operationName !== null) {
        runId = deriveOperationRunId(operationName, clientKey);
        const hit = opts.cache.get(operationName, clientKey, opts.now());
        if (hit !== null) {
          return c.body(hit.body, hit.status as 200 | 201 | 302 | 303 | 400 | 409 | 422 | 500 | 502 | 503 | 504, {
            ...(hit.headers ?? { 'Content-Type': 'application/json' }),
            'Idempotency-Replay': 'true',
          });
        }
      }
    }
    c.set('idempotency', { clientKey, runId });
    await next();
  };
}
