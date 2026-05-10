import { describe, expect, it } from 'bun:test';
import { SmokeVerifier, type SmokeFetcher } from '../src/smoke-verifier.js';

const stubFetcher = (
  responses: Record<
    string,
    { status: number; body?: string; contentType?: string; latencyMs?: number; throws?: 'timeout' | 'error' }
  >,
): SmokeFetcher => {
  return async (url, _opts) => {
    const response = responses[url];
    if (!response) throw new Error(`no stub for ${url}`);
    if (response.throws === 'timeout') return { status: 'timeout', latencyMs: response.latencyMs ?? 5_000 };
    if (response.throws === 'error') return { status: 'error', latencyMs: response.latencyMs ?? 0 };
    return {
      status: response.status,
      latencyMs: response.latencyMs ?? 1,
      body: response.body ?? '',
      contentType: response.contentType ?? 'text/plain',
    };
  };
};

describe('SmokeVerifier', () => {
  it('returns ok when health, UI, config, and protected API checks pass', async () => {
    const verifier = new SmokeVerifier(
      stubFetcher({
        'https://edge.example/health': { status: 200 },
        'https://edge.example/': { status: 200, body: '<html>', contentType: 'text/html' },
        'https://edge.example/config.json': { status: 200, body: '{"ok":true}', contentType: 'application/json' },
        'https://edge.example/api/notes': { status: 401, body: '{"code":"RUNTIME_AUTH_TOKEN_INVALID"}', contentType: 'application/json' },
      }),
    );

    const report = await verifier.verify({
      verificationHints: {
        healthUrl: 'https://edge.example/health',
        uiUrl: 'https://edge.example/',
        configUrl: 'https://edge.example/config.json',
        publicRouteUrls: [],
        protectedRouteChecks: [
          { name: 'protected-api-get-notes', method: 'GET', url: 'https://edge.example/api/notes' },
          { name: 'protected-api-post-notes', method: 'POST', url: 'https://edge.example/api/notes' },
        ],
      },
    });

    expect(report.ok).toBe(true);
    expect(report.partialOk).toBe(false);
    expect(report.checks.map((check) => check.name)).toEqual([
      'edge-health',
      'ui',
      'config-json',
      'protected-api-get-notes (no-auth)',
      'protected-api-get-notes (Bearer invalid.token.here)',
      'protected-api-get-notes (Bearer )',
      'protected-api-post-notes (no-auth)',
      'protected-api-post-notes (Bearer invalid.token.here)',
      'protected-api-post-notes (Bearer )',
    ]);
  });

  it('fails deployment when a protected API route returns runtime 500 instead of 401 JSON', async () => {
    const verifier = new SmokeVerifier(
      stubFetcher({
        'https://edge.example/health': { status: 200 },
        'https://edge.example/api/notes': {
          status: 500,
          body: '{"code":"BINDINGS_RUNTIME_EXPRESSION_ERROR"}',
          contentType: 'application/json',
        },
      }),
    );

    const report = await verifier.verify({
      verificationHints: {
        healthUrl: 'https://edge.example/health',
        publicRouteUrls: [],
        protectedRouteChecks: [
          { name: 'protected-api-get-notes', method: 'GET', url: 'https://edge.example/api/notes' },
        ],
      },
    });

    expect(report.ok).toBe(false);
    expect(report.partialOk).toBe(false);
    expect(report.checks).toContainEqual(
      expect.objectContaining({
        name: 'protected-api-get-notes (no-auth)',
        status: 500,
        ok: false,
      }),
    );
  });

  it('fails deployment when config.json is not valid JSON', async () => {
    const verifier = new SmokeVerifier(
      stubFetcher({
        'https://edge.example/health': { status: 200 },
        'https://edge.example/config.json': { status: 200, body: 'not-json', contentType: 'application/json' },
      }),
    );

    const report = await verifier.verify({
      verificationHints: {
        healthUrl: 'https://edge.example/health',
        configUrl: 'https://edge.example/config.json',
        publicRouteUrls: [],
        protectedRouteChecks: [],
      },
    });

    expect(report.ok).toBe(false);
    expect(report.partialOk).toBe(false);
  });

  it('accepts public route prefix 404 but rejects upstream failures', async () => {
    const verifier = new SmokeVerifier(
      stubFetcher({
        'https://edge.example/health': { status: 200 },
        'https://edge.example/api/orders': { status: 404 },
        'https://edge.example/api/inventory': { status: 502 },
      }),
    );

    const report = await verifier.verify({
      verificationHints: {
        healthUrl: 'https://edge.example/health',
        publicRouteUrls: ['https://edge.example/api/orders', 'https://edge.example/api/inventory'],
        protectedRouteChecks: [],
      },
    });

    expect(report.ok).toBe(false);
    expect(report.checks).toContainEqual(expect.objectContaining({
      name: 'public-route https://edge.example/api/orders',
      status: 404,
      ok: true,
    }));
    expect(report.checks).toContainEqual(expect.objectContaining({
      name: 'public-route https://edge.example/api/inventory',
      status: 502,
      ok: false,
    }));
  });

  it('returns ok when operaton UI auth checks reject unauthenticated access with 401', async () => {
    const verifier = new SmokeVerifier(
      stubFetcher({
        'https://edge.example/health': { status: 200 },
        'https://edge.example/operaton/ui': { status: 401 },
      }),
    );

    const report = await verifier.verify({
      verificationHints: {
        healthUrl: 'https://edge.example/health',
        publicRouteUrls: [],
        protectedRouteChecks: [],
        operatonUiAuthChecks: [{ name: 'operaton-ui', url: 'https://edge.example/operaton/ui' }],
      },
    });

    expect(report.ok).toBe(true);
    expect(report.checks.map((check) => check.name)).toEqual([
      'edge-health',
      'operaton-ui (no-auth)',
      'operaton-ui (invalid-basic)',
    ]);
    expect(report.checks).toContainEqual(expect.objectContaining({
      name: 'operaton-ui (no-auth)',
      status: 401,
      ok: true,
    }));
    expect(report.checks).toContainEqual(expect.objectContaining({
      name: 'operaton-ui (invalid-basic)',
      status: 401,
      ok: true,
    }));
  });

  it('fails deployment when operaton UI auth check returns 200 instead of 401', async () => {
    const verifier = new SmokeVerifier(
      stubFetcher({
        'https://edge.example/health': { status: 200 },
        'https://edge.example/operaton/ui': { status: 200 },
      }),
    );

    const report = await verifier.verify({
      verificationHints: {
        healthUrl: 'https://edge.example/health',
        publicRouteUrls: [],
        protectedRouteChecks: [],
        operatonUiAuthChecks: [{ name: 'operaton-ui', url: 'https://edge.example/operaton/ui' }],
      },
    });

    expect(report.ok).toBe(false);
    expect(report.checks).toContainEqual(expect.objectContaining({
      name: 'operaton-ui (no-auth)',
      status: 200,
      ok: false,
    }));
    expect(report.checks).toContainEqual(expect.objectContaining({
      name: 'operaton-ui (invalid-basic)',
      status: 200,
      ok: false,
    }));
  });
});
