import { describe, it, expect } from 'vitest';
import { applyEnvOverrides } from '../../src/manifest/validate.js';
import type { ValidatedManifest } from '../../src/manifest/types.js';

const base: ValidatedManifest = {
  rntmeVersion: { major: 1, minor: 0, patch: 0 },
  service: { name: 'svc', version: '1.0.0' },
  surface: {
    http: {
      enabled: true,
      port: 3000,
      bodyLimit: { enabled: true, maxBytes: 1_048_576 },
      rateLimit: { enabled: true, windowMs: 60_000, max: 600 },
    },
  },
  persistence: { mode: 'ephemeral' },
  bus: { mode: 'in-memory' },
  auth: { mode: 'header', headerName: 'x-actor-id', actorKind: 'user' },
  observability: {
    health: { path: '/health' },
    metrics: { path: '/metrics' },
  },
  seed: { enabled: true, path: 'seed.json' },
  modules: [],
};

describe('applyEnvOverrides', () => {
  it('is a no-op without any RNTME_* vars', () => {
    const r = applyEnvOverrides(base, {});
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual(base);
  });

  it('overrides RNTME_HTTP_PORT', () => {
    const r = applyEnvOverrides(base, { RNTME_HTTP_PORT: '8080' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.surface.http.port).toBe(8080);
  });

  it('rejects invalid port env', () => {
    const r = applyEnvOverrides(base, { RNTME_HTTP_PORT: 'abc' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe('MANIFEST_INVALID_PORT');
  });

  it('switches to persistent mode via env with paths', () => {
    const r = applyEnvOverrides(base, {
      RNTME_PERSISTENCE_MODE: 'persistent',
      RNTME_EVENT_STORE_PATH: '/tmp/e.db',
      RNTME_QSM_PATH: '/tmp/q.db',
    });
    expect(r.ok).toBe(true);
    if (r.ok && r.value.persistence.mode === 'persistent') {
      expect(r.value.persistence.eventStorePath).toBe('/tmp/e.db');
      expect(r.value.persistence.qsmPath).toBe('/tmp/q.db');
    }
  });

  it('errors when switching to persistent without paths', () => {
    const r = applyEnvOverrides(base, { RNTME_PERSISTENCE_MODE: 'persistent' });
    expect(r.ok).toBe(false);
  });

  it('overrides auth header name', () => {
    const r = applyEnvOverrides(base, { RNTME_AUTH_HEADER_NAME: 'x-user' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.auth.headerName).toBe('x-user');
  });
});
