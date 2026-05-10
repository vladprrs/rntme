import type { MiddlewareHandler } from 'hono';

export type SameOriginOptions = {
  code?: string;
};

export function sameOriginOnly(baseUrl: string, opts: SameOriginOptions = {}): MiddlewareHandler {
  const base = baseUrl.replace(/\/$/, '');
  const code = opts.code ?? 'CROSS_ORIGIN_BLOCKED';
  return async (c, next) => {
    if (c.req.method === 'GET' || c.req.method === 'HEAD' || c.req.method === 'OPTIONS') {
      return next();
    }
    const origin = c.req.header('origin');
    const referer = c.req.header('referer');
    const matches =
      (origin !== undefined && origin === base) ||
      (referer !== undefined && referer.startsWith(base + '/'));
    if (!matches) {
      return c.json({ error: { code, message: 'cross-origin request blocked' } }, 403);
    }
    return next();
  };
}
