import { describe, it, expect } from 'vitest';
import { validateManifest } from '../../src/manifest/validate.js';
import type { ParsedManifest } from '../../src/manifest/types.js';

const RUNTIME_VERSION = { major: 1, minor: 0, patch: 0 };
const MIN: ParsedManifest = {
  rntmeVersion: '1.0',
  service: { name: 'svc', version: '1.0.0' },
};

describe('validateManifest — studio block', () => {
  it('accepts manifest with no studio block (default)', () => {
    const r = validateManifest(MIN, RUNTIME_VERSION);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.studio.enabled).toBe(false);
    expect(r.value.studio.mountPath).toBe('/_studio');
    expect(r.value.studio.maxRows).toBe(10_000);
  });

  it('accepts studio with enabled:true', () => {
    const r = validateManifest({ ...MIN, studio: { enabled: true } }, RUNTIME_VERSION);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.studio.enabled).toBe(true);
    expect(r.value.studio.mountPath).toBe('/_studio');
  });

  it('rejects mountPath "/api" — conflicts with reserved prefix', () => {
    const r = validateManifest({ ...MIN, studio: { mountPath: '/api' } }, RUNTIME_VERSION);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'RUNTIME_MANIFEST_STUDIO_PATH_CONFLICT')).toBe(true);
  });

  it('rejects mountPath "/health" — conflicts with reserved prefix', () => {
    const r = validateManifest({ ...MIN, studio: { mountPath: '/health' } }, RUNTIME_VERSION);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'RUNTIME_MANIFEST_STUDIO_PATH_CONFLICT')).toBe(true);
  });

  it('rejects mountPath "/" — root path conflict', () => {
    const r = validateManifest({ ...MIN, studio: { mountPath: '/' } }, RUNTIME_VERSION);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'RUNTIME_MANIFEST_STUDIO_PATH_CONFLICT')).toBe(true);
  });

  it('accepts mountPath "/ap" — not a path-segment prefix of "/api"', () => {
    const r = validateManifest({ ...MIN, studio: { mountPath: '/ap' } }, RUNTIME_VERSION);
    expect(r.ok).toBe(true);
  });

  it('rejects maxRows 0 — below minimum', () => {
    const r = validateManifest({ ...MIN, studio: { maxRows: 0 } }, RUNTIME_VERSION);
    expect(r.ok).toBe(false);
  });
});
