import { describe, it, expect } from 'bun:test';
import { validateManifest } from '../../src/manifest/validate.js';
import type { ParsedManifest } from '../../src/manifest/types.js';

const RUNTIME_VERSION = { major: 1, minor: 0, patch: 0 };
const MIN: ParsedManifest = {
  rntmeVersion: '1.0',
  service: { name: 'svc', version: '1.0.0' },
};

describe('validateManifest', () => {
  it('applies defaults for optional sections', () => {
    const r = validateManifest(MIN, RUNTIME_VERSION);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.surface.http.enabled).toBe(true);
    expect(r.value.surface.http.port).toBe(3000);
    expect(r.value.surface.http.bodyLimit).toEqual({ enabled: true, maxBytes: 1_048_576 });
    expect(r.value.surface.http.rateLimit).toEqual({ enabled: true, windowMs: 60_000, max: 600 });
    expect(r.value.persistence.mode).toBe('ephemeral');
    expect(r.value.bus.mode).toBe('in-memory');
    expect(r.value.auth.headerName).toBe('x-actor-id');
    expect(r.value.auth.actorKind).toBe('user');
    expect(r.value.observability.health.path).toBe('/health');
    expect(r.value.observability.metrics.path).toBe('/metrics');
  });

  it('parses rntmeVersion to triple', () => {
    const r = validateManifest(MIN, RUNTIME_VERSION);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.rntmeVersion).toEqual({ major: 1, minor: 0, patch: 0 });
  });

  it('rejects invalid rntmeVersion string', () => {
    const r = validateManifest({ ...MIN, rntmeVersion: 'banana' }, RUNTIME_VERSION);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe('MANIFEST_INVALID_VERSION');
  });

  it('fails fast on major mismatch', () => {
    const r = validateManifest({ ...MIN, rntmeVersion: '2.0' }, RUNTIME_VERSION);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe('MANIFEST_VERSION_MAJOR_MISMATCH');
  });

  it('requires eventStorePath/qsmPath in persistent mode', () => {
    const r = validateManifest(
      { ...MIN, persistence: { mode: 'persistent' } },
      RUNTIME_VERSION,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.code === 'MANIFEST_MISSING_EVENT_STORE_PATH')).toBe(true);
      expect(r.errors.some((e) => e.code === 'MANIFEST_MISSING_QSM_PATH')).toBe(true);
    }
  });

  it('accepts persistent mode with paths', () => {
    const r = validateManifest(
      {
        ...MIN,
        persistence: {
          mode: 'persistent',
          eventStorePath: '/data/events.db',
          qsmPath: '/data/qsm.db',
        },
      },
      RUNTIME_VERSION,
    );
    expect(r.ok).toBe(true);
  });

  it('preserves explicit HTTP body and rate limit config', () => {
    const r = validateManifest(
      {
        ...MIN,
        surface: {
          http: {
            bodyLimit: { enabled: false, maxBytes: 4096 },
            rateLimit: { enabled: true, windowMs: 2000, max: 2 },
          },
        },
      },
      RUNTIME_VERSION,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.surface.http.bodyLimit).toEqual({ enabled: false, maxBytes: 4096 });
    expect(r.value.surface.http.rateLimit).toEqual({ enabled: true, windowMs: 2000, max: 2 });
  });

  it('rejects partial module TLS key/certificate pairs', () => {
    const r = validateManifest(
      {
        ...MIN,
        modules: [
          {
            name: 'identity',
            grpc: { address: 'identity:50051', tls: { privateKeyPath: 'client.key' } },
            protoPath: 'identity.proto',
          },
        ],
      },
      RUNTIME_VERSION,
    );

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'MANIFEST_INVALID_TYPE',
            path: 'modules.0.grpc.tls',
          }),
        ]),
      );
    }
  });

  it('rejects auth.actorKind outside the event-store actor union', () => {
    const r = validateManifest(
      { ...MIN, auth: { mode: 'header', actorKind: 'owner' } },
      RUNTIME_VERSION,
    );

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'MANIFEST_INVALID_ACTOR_KIND',
            path: 'auth.actorKind',
          }),
        ]),
      );
    }
  });
});
