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
  secrets: [{ name: 'CLERK_SECRET_KEY', scope: 'tenant' as const }],
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

  it('rejects manifest with no client and no non-empty capabilities', () => {
    const parsed = parseModuleManifest({ name: 'identity-clerk', version: '1.0.0' });

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.errors.some((e) => e.message.includes('MODULE_MANIFEST_EMPTY'))).toBe(true);
    }
  });

  it('accepts checked-in identity module manifests without local rewrites', () => {
    for (const moduleDir of ['auth0', 'clerk', 'workos']) {
      const raw = JSON.parse(
        readFileSync(
          join(process.cwd(), '..', '..', '..', 'modules', 'identity', moduleDir, 'module.json'),
          'utf8',
        ),
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

describe('parseModuleManifest — relaxed top-level + client block', () => {
  it('accepts UI-only manifest (no category, no capabilities, only client.components)', () => {
    const raw = {
      name: '@rntme/presentation-md-mermaid',
      version: '0.0.0',
      client: {
        entry: './client/index.ts',
        components: [
          { type: 'Markdown', props: { source: { type: 'string', required: true } } },
          { type: 'Mermaid', props: { source: { type: 'string', required: true } } },
        ],
      },
    };
    const r = parseModuleManifest(raw);
    expect(r.ok).toBe(true);
  });

  it('accepts mixed manifest (category + capabilities + client.boot + operations)', () => {
    const raw = {
      name: '@rntme/analytics-google-analytics',
      version: '0.0.0',
      category: 'analytics',
      vendor: 'google-analytics',
      contract: 'analytics/v1',
      capabilities: { rpcs: [], events: [] },
      client: {
        entry: './client/index.ts',
        boot: true,
        config: { schema: { measurementId: { type: 'string', required: true } } },
        operations: [
          { name: 'track', params: { event: { type: 'string', required: true } } },
          { name: 'identify', params: { userId: { type: 'string', required: true } } },
        ],
      },
    };
    const r = parseModuleManifest(raw);
    expect(r.ok).toBe(true);
  });

  it('rejects manifest with no capabilities and no client (MODULE_MANIFEST_EMPTY)', () => {
    const raw = { name: '@rntme/empty', version: '0.0.0' };
    const r = parseModuleManifest(raw);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.message.includes('MODULE_MANIFEST_EMPTY'))).toBe(true);
  });

  it('rejects category without contract (MODULE_MANIFEST_CATEGORY_REQUIRES_CONTRACT)', () => {
    const raw = {
      name: '@rntme/x',
      version: '0.0.0',
      category: 'analytics',
      capabilities: { rpcs: ['Foo'], events: [] },
    };
    const r = parseModuleManifest(raw);
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.errors.some((e) => e.message.includes('MODULE_MANIFEST_CATEGORY_REQUIRES_CONTRACT'))).toBe(
        true,
      );
  });

  it('rejects duplicate component types (MODULE_MANIFEST_DUPLICATE_COMPONENT)', () => {
    const raw = {
      name: '@rntme/x',
      version: '0.0.0',
      client: {
        entry: './client/index.ts',
        components: [
          { type: 'Markdown', props: {} },
          { type: 'Markdown', props: {} },
        ],
      },
    };
    const r = parseModuleManifest(raw);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.message.includes('MODULE_MANIFEST_DUPLICATE_COMPONENT'))).toBe(true);
  });

  it('rejects duplicate operation names (MODULE_MANIFEST_DUPLICATE_OPERATION)', () => {
    const raw = {
      name: '@rntme/x',
      version: '0.0.0',
      client: {
        entry: './client/index.ts',
        boot: true,
        operations: [
          { name: 'track', params: {} },
          { name: 'track', params: {} },
        ],
      },
    };
    const r = parseModuleManifest(raw);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.message.includes('MODULE_MANIFEST_DUPLICATE_OPERATION'))).toBe(true);
  });

  it('rejects appliesTo referencing unknown component (MODULE_MANIFEST_OPERATION_BAD_APPLIES_TO)', () => {
    const raw = {
      name: '@rntme/x',
      version: '0.0.0',
      client: {
        entry: './client/index.ts',
        components: [{ type: 'A', props: {} }],
        operations: [{ name: 'op', appliesTo: ['Z'], params: {} }],
      },
    };
    const r = parseModuleManifest(raw);
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.errors.some((e) => e.message.includes('MODULE_MANIFEST_OPERATION_BAD_APPLIES_TO'))).toBe(true);
  });

  it('still accepts the original backend-only manifest shape', () => {
    const raw = {
      name: '@rntme/identity-clerk',
      version: '0.0.0',
      category: 'identity',
      vendor: 'clerk',
      contract: 'identity/v1',
      capabilities: { rpcs: ['GetUser'], events: ['rntme.identity.v1.UserCreated'] },
    };
    const r = parseModuleManifest(raw);
    expect(r.ok).toBe(true);
  });
});
