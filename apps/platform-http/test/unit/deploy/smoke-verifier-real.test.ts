import { describe, expect, it, mock } from 'bun:test';
import { SmokeVerifier, type SmokeFetcher } from '@rntme/deploy-runner';

const ok401 = { status: 401, latencyMs: 1, body: '{"code":"RUNTIME_AUTH_TOKEN_INVALID","message":"authentication required"}', contentType: 'application/json' };
const ok200 = { status: 200, latencyMs: 1, contentType: 'text/plain' };

describe('SmokeVerifier real probes', () => {
  it('removes "not auto-checked in MVP" placeholder for public routes', async () => {
    const fetcher = mock(async () => ok200);
    const v = new SmokeVerifier(fetcher as unknown as SmokeFetcher);
    const report = await v.verify({
      verificationHints: {
        healthUrl: 'http://x/health',
        publicRouteUrls: ['http://x/'],
        protectedRouteChecks: [],
      },
    });
    expect(report.checks.every((c) => c.note !== 'not auto-checked in MVP')).toBe(true);
  });

  it('runs three probes per protected route (no-bearer, fake-bearer, empty-bearer)', async () => {
    const calls: { url: string; headers?: Record<string, string> }[] = [];
    const fetcher: SmokeFetcher = async (url, opts) => {
      calls.push(opts.headers === undefined ? { url } : { url, headers: opts.headers });
      if (url === 'http://x/health') return { status: 200, latencyMs: 1, contentType: 'text/plain' };
      return ok401;
    };
    const v = new SmokeVerifier(fetcher);
    const report = await v.verify({
      verificationHints: {
        healthUrl: 'http://x/health',
        publicRouteUrls: [],
        protectedRouteChecks: [{ name: 'api-notes', method: 'GET', url: 'http://x/api/notes' }],
      },
    });
    expect(calls.filter((c) => c.url === 'http://x/api/notes').length).toBe(3);
    expect(report.ok).toBe(true);
  });

  it('fails the deployment when a protected probe returns 200 instead of 401', async () => {
    const fetcher: SmokeFetcher = async (_url, _opts) => ok200;
    const v = new SmokeVerifier(fetcher);
    const report = await v.verify({
      verificationHints: {
        healthUrl: 'http://x/health',
        publicRouteUrls: [],
        protectedRouteChecks: [{ name: 'api-notes', method: 'GET', url: 'http://x/api/notes' }],
      },
    });
    expect(report.ok).toBe(false);
  });

  it('runs two probes per operaton UI auth check (no-auth, invalid-basic)', async () => {
    const calls: { url: string; headers?: Record<string, string> }[] = [];
    const fetcher: SmokeFetcher = async (url, opts) => {
      calls.push(opts.headers === undefined ? { url } : { url, headers: opts.headers });
      if (url === 'http://x/health') return { status: 200, latencyMs: 1, contentType: 'text/plain' };
      return ok401;
    };
    const v = new SmokeVerifier(fetcher);
    const report = await v.verify({
      verificationHints: {
        healthUrl: 'http://x/health',
        publicRouteUrls: [],
        protectedRouteChecks: [],
        operatonUiAuthChecks: [{ name: 'operaton-ui', url: 'http://x/operaton/ui' }],
      },
    });
    expect(calls.filter((c) => c.url === 'http://x/operaton/ui').length).toBe(2);
    expect(calls.some((c) => c.url === 'http://x/operaton/ui' && c.headers?.Authorization?.startsWith('Basic '))).toBe(true);
    expect(report.ok).toBe(true);
    expect(report.checks.map((c) => c.name)).toContain('operaton-ui (no-auth)');
    expect(report.checks.map((c) => c.name)).toContain('operaton-ui (invalid-basic)');
  });

  it('fails the deployment when an operaton UI auth check returns 200 instead of 401', async () => {
    const fetcher: SmokeFetcher = async (_url, _opts) => ok200;
    const v = new SmokeVerifier(fetcher);
    const report = await v.verify({
      verificationHints: {
        healthUrl: 'http://x/health',
        publicRouteUrls: [],
        protectedRouteChecks: [],
        operatonUiAuthChecks: [{ name: 'operaton-ui', url: 'http://x/operaton/ui' }],
      },
    });
    expect(report.ok).toBe(false);
    expect(report.checks).toContainEqual(expect.objectContaining({ name: 'operaton-ui (no-auth)', status: 200, ok: false }));
    expect(report.checks).toContainEqual(expect.objectContaining({ name: 'operaton-ui (invalid-basic)', status: 200, ok: false }));
  });
});
