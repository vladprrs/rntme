import { describe, it, expect, mock } from 'bun:test';
import pino from 'pino';
import type { Pool } from 'pg';
import type { BlobStore } from '@rntme/platform-core';
import { RandomIds } from '@rntme/platform-core';
import { parseEnv } from '../../src/config/env.js';
import { createApp, type AppDeps } from '../../src/app.js';

const baseline = {
  DATABASE_URL: 'postgres://x',
  RUSTFS_ENDPOINT: 'https://rustfs.internal',
  RUSTFS_ACCESS_KEY_ID: 'k',
  RUSTFS_SECRET_ACCESS_KEY: 's',
  RUSTFS_BUCKET: 'b',
  WORKOS_API_KEY: 'wk',
  WORKOS_CLIENT_ID: 'wc',
  WORKOS_WEBHOOK_SECRET: 'ww',
  WORKOS_REDIRECT_URI: 'https://platform.rntme.com/v1/auth/callback',
  PLATFORM_BASE_URL: 'https://platform.rntme.com',
  PLATFORM_SESSION_COOKIE_DOMAIN: '.rntme.com',
  PLATFORM_CORS_ORIGINS: 'https://*.rntme.com',
  PLATFORM_SECRET_ENCRYPTION_KEY: 'a'.repeat(64),
  PLATFORM_COOKIE_PASSWORD: 'y'.repeat(32),
};

function buildDeps(): AppDeps {
  return {
    env: parseEnv(baseline),
    logger: pino({ level: 'silent' }),
    workos: {} as AppDeps['workos'],
    cookiePassword: 'x'.repeat(32),
    pool: { query: mock().mockResolvedValue({}) } as unknown as Pool,
    blob: { presignedGet: async () => ({ ok: true as const, value: 'http://x' }) } as unknown as BlobStore,
    ids: new RandomIds(),
    enableBackgroundLoops: false,
    poolRepos: {} as AppDeps['poolRepos'],
  };
}

describe('createApp', () => {
  it('GET /health returns 200 ok', async () => {
    const app = await createApp(buildDeps());
    const r = await app.request('/health');
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ status: 'ok' });
  });

  it('GET /login renders the UI LoginPage instead of 401 JSON', async () => {
    const app = await createApp(buildDeps());
    const r = await app.request('/login');
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type') ?? '').toMatch(/text\/html/);
  });

  it('GET /v1/auth/me still requires auth (401 JSON)', async () => {
    const app = await createApp(buildDeps());
    const r = await app.request('/v1/auth/me');
    expect(r.status).toBe(401);
    expect(r.headers.get('content-type') ?? '').toMatch(/application\/json/);
  });

  it('serves blueprint runtime when PLATFORM_RUNTIME_MODE=blueprint', async () => {
    const deps = buildDeps();
    deps.env = parseEnv({ ...baseline, PLATFORM_RUNTIME_MODE: 'blueprint' });
    const app = await createApp(deps);
    // Legacy auth gate is absent — SPA fallback serves HTML shell for unrecognised paths
    const authMe = await app.request('/v1/auth/me');
    expect(authMe.status).not.toBe(401);
    // UI manifest route must be served by the platform runtime
    const manifest = await app.request('/_manifest.json');
    expect(manifest.status).toBe(200);
  });
});
