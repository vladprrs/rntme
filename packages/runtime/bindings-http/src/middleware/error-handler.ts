import type { ErrorHandler } from 'hono';
import type pino from 'pino';

export type ErrorHandlerOptions = {
  logger?: Pick<pino.Logger, 'error'>;
  code?: string;
  message?: string;
};

export function errorHandler(opts: ErrorHandlerOptions = {}): ErrorHandler {
  const code = opts.code ?? 'INTERNAL_ERROR';
  const message = opts.message ?? 'Internal server error';
  return (cause, c) => {
    opts.logger?.error(
      {
        err: cause,
        requestId: c.get('requestId'),
        method: c.req.method,
        path: c.req.path,
        route: c.req.routePath,
        status: 500,
      },
      'unhandled error',
    );
    return c.json({ error: { code, message } }, 500);
  };
}
