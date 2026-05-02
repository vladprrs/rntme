import { describe, expect, it, vi } from 'vitest';
import { SmokeVerifier, type SmokeFetcher } from '../../../src/deploy/smoke-verifier.js';

const ok401 = { status: 401, latencyMs: 1, body: '{"code":"RUNTIME_AUTH_TOKEN_INVALID","message":"authentication required"}', contentType: 'application/json' };
const ok200html = { status: 200, latencyMs: 1, body: '<!doctype html>', contentType: 'text/html' };
const ok200 = { status: 200, latencyMs: 1, contentType: 'text/plain' };

describe('SmokeVerifier real probes', () => {
  it('removes "not auto-checked in MVP" placeholder for public routes', async () => {
    const fetcher = vi.fn(async () => ok200);
    const v = new SmokeVerifier(fetcher as unknown as SmokeFetcher);
    const report = await v.verify({
      verificationHints: {
        healthUrl: 'http://x/health',
        publicRouteUrls: ['http://x/'],
      },
    });
    expect(report.checks.every((c) => c.note !== 'not auto-checked in MVP')).toBe(true);
  });

  it('runs three probes per protected route (no-bearer, fake-bearer, empty-bearer)', async () => {
    const calls: { url: string; headers?: Record<string, string> }[] = [];
    const fetcher: SmokeFetcher = async (url, opts) => {
      calls.push({ url, headers: opts.headers });
      if (url === 'http://x/health') return { status: 200, latencyMs: 1, contentType: 'text/plain' };
      return ok401;
    };
    const v = new SmokeVerifier(fetcher);
    const report = await v.verify({
      verificationHints: {
        healthUrl: 'http://x/health',
        publicRouteUrls: [],
        protectedRoutes: [{ name: 'api-notes', method: 'GET', url: 'http://x/api/notes' }],
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
        protectedRoutes: [{ name: 'api-notes', method: 'GET', url: 'http://x/api/notes' }],
      },
    });
    expect(report.ok).toBe(false);
  });
});
