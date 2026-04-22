import { describe, it, expect } from 'vitest';
import { parseManifest } from '../../src/manifest/parse.js';

const MIN = {
  rntmeVersion: '1.0',
  service: { name: 'svc', version: '1.0.0' },
};

describe('parseManifest', () => {
  it('parses a minimal valid manifest', () => {
    const r = parseManifest(JSON.stringify(MIN));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.service.name).toBe('svc');
  });

  it('errors on non-JSON input', () => {
    const r = parseManifest('not { json');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe('MANIFEST_NOT_JSON');
  });

  it('errors on array/non-object JSON', () => {
    const r = parseManifest('[]');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe('MANIFEST_NOT_OBJECT');
  });

  it('rejects unknown top-level keys (strict)', () => {
    const r = parseManifest(JSON.stringify({ ...MIN, unknownKey: 1 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'MANIFEST_UNKNOWN_KEY')).toBe(true);
  });

  it('reports missing service.name', () => {
    const r = parseManifest(JSON.stringify({ rntmeVersion: '1.0', service: { version: '1.0.0' } }));
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.errors.some((e) => e.path === 'service.name' && e.code === 'MANIFEST_MISSING_FIELD')).toBe(
        true,
      );
  });

  it('accepts optional observability overrides', () => {
    const r = parseManifest(
      JSON.stringify({
        ...MIN,
        observability: { health: { path: '/hz' }, metrics: { path: '/m' } },
      }),
    );
    expect(r.ok).toBe(true);
  });

  it('parses modules[] with grpc address and protoPath', () => {
    const result = parseManifest(
      JSON.stringify({
        rntmeVersion: '1.0',
        service: { name: 'subs', version: '1.0' },
        modules: [
          { name: 'payments', grpc: { address: 'payments:50051' }, protoPath: 'protos/payments.proto' },
        ],
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.modules?.[0]?.name).toBe('payments');
    }
  });

  it('rejects module with empty name', () => {
    const result = parseManifest(
      JSON.stringify({
        rntmeVersion: '1.0',
        service: { name: 'subs', version: '1.0' },
        modules: [{ name: '', grpc: { address: 'a:1' }, protoPath: 'p' }],
      }),
    );
    expect(result.ok).toBe(false);
  });
});
