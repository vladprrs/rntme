import { describe, expect, it } from 'vitest';
import { ModuleManifestSchema, parseModuleManifest } from '../../src/manifest-shape.js';

const VALID_MANIFEST = {
  name: 'identity-clerk',
  version: '1.0.0',
  contact: 'identity-team@example.com',
  grpcServiceName: 'rntme.identity.v1.IdentityModule',
  webhookPath: '/webhooks/clerk',
  secrets: [{ name: 'CLERK_SECRET_KEY', scope: 'tenant' }],
  capabilities: ['identity.users.read', 'identity.users.write'],
};

describe('ModuleManifestSchema', () => {
  it('accepts the full module contract shape', () => {
    const parsed = parseModuleManifest(VALID_MANIFEST);

    expect(parsed).toEqual({ ok: true, value: VALID_MANIFEST });
  });

  it('rejects missing required fields with stable paths', () => {
    const parsed = parseModuleManifest({ name: 'identity-clerk', version: '1.0.0' });

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.errors.map((e) => e.path).sort()).toEqual([
        'capabilities',
        'contact',
        'grpcServiceName',
        'secrets',
        'webhookPath',
      ]);
    }
  });

  it('rejects unknown keys', () => {
    const parsed = ModuleManifestSchema.safeParse({ ...VALID_MANIFEST, unexpected: true });

    expect(parsed.success).toBe(false);
  });
});
