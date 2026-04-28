import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ModuleManifestSchema, parseModuleManifest } from '../../src/manifest-shape.js';

const VALID_MANIFEST = {
  name: 'identity-clerk',
  version: '1.0.0',
  category: 'identity',
  vendor: 'clerk',
  contract: 'identity/v1',
  contact: 'identity-team@example.com',
  grpcServiceName: 'rntme.identity.v1.IdentityModule',
  webhookPath: '/webhooks/clerk',
  secrets: [{ name: 'CLERK_SECRET_KEY', scope: 'tenant' }],
  capabilities: {
    rpcs: ['GetUser', 'CreateUser'],
    events: ['rntme.identity.v1.UserCreated'],
  },
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
        'category',
        'contract',
        'vendor',
      ]);
    }
  });

  it('accepts checked-in identity module manifests without local rewrites', () => {
    for (const moduleDir of ['auth0', 'clerk', 'workos']) {
      const raw = JSON.parse(
        readFileSync(join(process.cwd(), '..', '..', 'modules', 'identity', moduleDir, 'module.json'), 'utf8'),
      ) as unknown;

      const parsed = parseModuleManifest(raw);

      expect(parsed.ok, moduleDir).toBe(true);
    }
  });

  it('rejects unknown keys', () => {
    const parsed = ModuleManifestSchema.safeParse({ ...VALID_MANIFEST, unexpected: true });

    expect(parsed.success).toBe(false);
  });
});
