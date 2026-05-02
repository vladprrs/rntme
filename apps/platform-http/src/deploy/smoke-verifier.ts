import { clearTimeout, setTimeout } from 'node:timers';
import type { VerificationReport } from '@rntme/platform-core';

export type SmokeFetcher = (
  url: string,
  opts: { method: 'HEAD' | 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'; timeoutMs: number; headers?: Record<string, string> },
) => Promise<{ status: number | 'timeout' | 'error'; latencyMs: number; body?: string; contentType?: string }>;

export type ProtectedRouteSpec = Readonly<{
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
}>;

export type VerificationHints = {
  readonly healthUrl: string;
  readonly uiUrl?: string;
  readonly configUrl?: string;
  readonly publicRouteUrls: readonly string[];
  readonly protectedRoutes?: readonly ProtectedRouteSpec[];
  /** @deprecated Use protectedRoutes instead. Kept for one transition PR. */
  readonly protectedRouteChecks?: readonly { readonly name: string; readonly method: 'GET' | 'POST'; readonly url: string }[];
};

export class SmokeVerifier {
  constructor(private readonly fetcher: SmokeFetcher = defaultSmokeFetcher) {}

  async verify(applyResult: { verificationHints: VerificationHints }): Promise<VerificationReport> {
    const checks: VerificationReport['checks'] = [];
    const { verificationHints } = applyResult;

    const edge = await this.fetcher(verificationHints.healthUrl, {
      method: 'HEAD',
      timeoutMs: 5_000,
    });
    checks.push({
      name: 'edge-health',
      url: verificationHints.healthUrl,
      status: edge.status,
      latencyMs: edge.latencyMs,
      ok: is2xx(edge.status),
    });

    if (verificationHints.uiUrl) {
      const ui = await this.fetcher(verificationHints.uiUrl, {
        method: 'GET',
        timeoutMs: 10_000,
      });
      checks.push({
        name: 'ui',
        url: verificationHints.uiUrl,
        status: ui.status,
        latencyMs: ui.latencyMs,
        ok: is2xx(ui.status) && isHtml(ui.contentType) && (ui.body ?? '').length > 0,
      });
    }

    if (verificationHints.configUrl) {
      const config = await this.fetcher(verificationHints.configUrl, {
        method: 'GET',
        timeoutMs: 5_000,
      });
      checks.push({
        name: 'config-json',
        url: verificationHints.configUrl,
        status: config.status,
        latencyMs: config.latencyMs,
        ok: is2xx(config.status) && isJson(config.contentType) && parsesJson(config.body ?? ''),
      });
    }

    const protectedRoutes = verificationHints.protectedRoutes ?? verificationHints.protectedRouteChecks ?? [];
    for (const route of protectedRoutes) {
      for (const auth of [undefined, 'Bearer invalid.token.here', 'Bearer '] as const) {
        const headers = auth ? { Authorization: auth } : undefined;
        const r = await this.fetcher(route.url, { method: route.method, timeoutMs: 5_000, headers });
        let bodyOk = false;
        try {
          const parsed = r.body ? JSON.parse(r.body) : {};
          bodyOk = parsed?.code === 'RUNTIME_AUTH_TOKEN_INVALID';
        } catch {
          bodyOk = false;
        }
        checks.push({
          name: `${route.name} (${auth ?? 'no-auth'})`,
          url: route.url,
          status: r.status,
          latencyMs: r.latencyMs,
          ok: r.status === 401 && isJson(r.contentType) && bodyOk,
        });
      }
    }

    for (const url of verificationHints.publicRouteUrls) {
      const r = await this.fetcher(url, { method: 'GET', timeoutMs: 5_000 });
      checks.push({
        name: `public-route ${url}`,
        url,
        status: r.status,
        latencyMs: r.latencyMs,
        ok: is2xx(r.status),
      });
    }

    const ok = checks.every((check) => check.ok);
    return {
      checks,
      ok,
      partialOk: false,
    };
  }
}

export const defaultSmokeFetcher: SmokeFetcher = async (url, opts) => {
  const start = Date.now();
  const ctrl = new globalThis.AbortController();
  const timeout = setTimeout(() => ctrl.abort(), opts.timeoutMs);
  try {
    const response = await globalThis.fetch(url, {
      method: opts.method,
      signal: ctrl.signal,
      ...(opts.headers ? { headers: opts.headers } : {}),
    });
    const body = opts.method === 'GET' || opts.method === 'POST' || opts.method === 'PUT' || opts.method === 'PATCH' || opts.method === 'DELETE'
      ? await response.text()
      : undefined;
    const contentType = response.headers.get('content-type');
    return {
      status: response.status,
      latencyMs: Date.now() - start,
      ...(contentType === null ? {} : { contentType }),
      ...(body === undefined ? {} : { body }),
    };
  } catch (cause) {
    const name = cause instanceof Error ? cause.name : '';
    return {
      status: name === 'AbortError' ? 'timeout' : 'error',
      latencyMs: Date.now() - start,
    };
  } finally {
    clearTimeout(timeout);
  }
};

function is2xx(status: number | 'timeout' | 'error'): boolean {
  return typeof status === 'number' && status >= 200 && status < 300;
}

function isHtml(contentType: string | undefined): boolean {
  return contentType?.toLowerCase().includes('text/html') === true;
}

function isJson(contentType: string | undefined): boolean {
  return contentType?.toLowerCase().includes('application/json') === true;
}

function parsesJson(body: string): boolean {
  try {
    JSON.parse(body);
    return true;
  } catch {
    return false;
  }
}
