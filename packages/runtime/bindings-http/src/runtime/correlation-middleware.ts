import type { MiddlewareHandler } from 'hono';
import { randomUUID } from 'node:crypto';
import type { CorrelationCtx } from '@rntme/graph-ir-compiler';

const TP_RE = /^[0-9a-f]{2}-([0-9a-f]{32})-[0-9a-f]{16}-[0-9a-f]{2}$/;
// Conservative shape for correlation-id — it is persisted to event_log and
// echoed on every response, so untrusted input must be bounded in length and
// restricted to a safe charset. 1..128 chars of [A-Za-z0-9._:-].
const CORRELATION_ID_RE = /^[A-Za-z0-9._:-]{1,128}$/;

export type { CorrelationCtx };

export type CorrelationVariables = { correlation: CorrelationCtx };

export function correlationMiddleware(): MiddlewareHandler<{ Variables: CorrelationVariables }> {
  return async (c, next) => {
    const rawIncoming = c.req.header('Correlation-Id');
    const incoming = rawIncoming && CORRELATION_ID_RE.test(rawIncoming) ? rawIncoming : undefined;
    const tpRaw = c.req.header('traceparent');
    const tpMatch = tpRaw ? TP_RE.exec(tpRaw) : null;
    const traceparent = tpMatch ? tpRaw! : null;
    const correlationId = incoming ?? (tpMatch ? tpMatch[1]! : randomUUID());
    const commandId = randomUUID();
    c.set('correlation', { commandId, correlationId, traceparent });
    c.res.headers.set('Correlation-Id', correlationId);
    await next();
    // Re-set header after downstream handler (Hono may rebuild Response)
    c.res.headers.set('Correlation-Id', correlationId);
  };
}
