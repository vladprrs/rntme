import type { MiddlewareHandler } from 'hono';
import type pino from 'pino';

export type RequestLoggerOptions = {
  logger: pino.Logger;
};

export function requestLogger(opts: RequestLoggerOptions): MiddlewareHandler {
  return async (c, next) => {
    const start = Date.now();
    await next();
    const durationMs = Date.now() - start;
    opts.logger.info(
      {
        requestId: c.get('requestId'),
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        durationMs,
      },
      'request',
    );
  };
}
