import type { MiddlewareHandler } from 'hono';

export type SecurityHeadersOptions = {
  csp?: string;
  contentTypeOptions?: string | null;
  referrerPolicy?: string | null;
};

export function securityHeaders(opts: SecurityHeadersOptions = {}): MiddlewareHandler {
  const csp = opts.csp;
  const contentTypeOptions = opts.contentTypeOptions === undefined ? 'nosniff' : opts.contentTypeOptions;
  const referrerPolicy =
    opts.referrerPolicy === undefined ? 'strict-origin-when-cross-origin' : opts.referrerPolicy;
  return async (c, next) => {
    await next();
    if (csp !== undefined && csp !== '') c.res.headers.set('Content-Security-Policy', csp);
    if (contentTypeOptions !== null) c.res.headers.set('X-Content-Type-Options', contentTypeOptions);
    if (referrerPolicy !== null) c.res.headers.set('Referrer-Policy', referrerPolicy);
  };
}
