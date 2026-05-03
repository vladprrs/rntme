import { describe, expect, it } from 'vitest';
import pino from 'pino';
import { RandomIds } from '@rntme/platform-core';
import { parseEnv } from '../../../src/config/env.js';
import { createApp } from '../../../src/app.js';

describe('helpful 404 for project-scoped deploy-targets', () => {
  it('returns helpful body for project-scoped deploy-targets', async () => {
    const app = createApp({
      env: parseEnv({
        DATABASE_URL: 'postgres://localhost:5432/test',
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
        PLATFORM_SECRET_ENCRYPTION_KEY: 'a'.repeat(64),
        PLATFORM_COOKIE_PASSWORD: 'y'.repeat(32),
      }),
      logger: pino({ level: 'silent' }),
      pool: { query: () => Promise.resolve({ rows: [] }) } as never,
      poolRepos: {
        organizations: {} as never,
        accounts: {} as never,
        memberships: {} as never,
        workosEventLog: {} as never,
        projects: {} as never,
        tokens: {} as never,
      },
      workos: {} as never,
      cookiePassword: 'testtesttesttesttesttesttesttest',
      blob: { presignedGet: async () => ({ ok: true as const, value: 'http://x' }) } as never,
      ids: new RandomIds(),
      enableBackgroundLoops: false,
    });

    const r = await app.request('/v1/orgs/o/projects/p/deploy-targets', {
      method: 'GET',
    });
    expect(r.status).toBe(404);
    const body = await r.json();
    expect(body.error.code).toBe('PLATFORM_HTTP_NOT_FOUND');
    expect(body.error.message).toMatch(/org-scoped/);
  });
});
