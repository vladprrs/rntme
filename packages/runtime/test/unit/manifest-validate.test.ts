import { describe, it, expect } from 'vitest';
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
});
