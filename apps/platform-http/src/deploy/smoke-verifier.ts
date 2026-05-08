import { Buffer } from 'node:buffer';
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
  readonly protectedRouteChecks: readonly ProtectedRouteSpec[];
  readonly operatonUiAuthChecks?: readonly { readonly name: string; readonly url: string }[];
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

    for (const route of verificationHints.protectedRouteChecks) {
      for (const auth of [undefined, 'Bearer invalid.token.here', 'Bearer '] as const) {
        const r = await this.fetcher(route.url, {
          method: route.method,
          timeoutMs: 5_000,
          ...(auth ? { headers: { Authorization: auth } } : {}),
        });
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

    for (const check of verificationHints.operatonUiAuthChecks ?? []) {
      for (const [label, auth] of [
        ['no-auth', undefined],
        ['invalid-basic', `Basic ${Buffer.from('invalid:invalid').toString('base64')}`],
      ] as const) {
        const r = await this.fetcher(check.url, {
          method: 'GET',
          timeoutMs: 5_000,
          ...(auth ? { headers: { Authorization: auth } } : {}),
        });
        checks.push({
          name: `${check.name} (${label})`,
          url: check.url,
          status: r.status,
          latencyMs: r.latencyMs,
          ok: r.status === 401,
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
        ok: isReachableEdgeRouteStatus(r.status),
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

function isReachableEdgeRouteStatus(status: number | 'timeout' | 'error'): boolean {
  return typeof status === 'number' && status >= 200 && status < 500;
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
