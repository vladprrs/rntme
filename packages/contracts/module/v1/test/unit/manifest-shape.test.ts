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
          join(process.cwd(), '..', '..', '..', '..', 'modules', 'identity', moduleDir, 'module.json'),
          'utf8',
        ),
      ) as unknown;

      const parsed = parseModuleManifest(raw);

      expect(parsed.ok, moduleDir).toBe(true);
    }
  });

  it('accepts the checked-in OpenRouter AI/LLM manifest without local rewrites', () => {
    const raw = JSON.parse(
      readFileSync(
        join(process.cwd(), '..', '..', '..', '..', 'modules', 'ai-llm', 'openrouter', 'module.json'),
        'utf8',
      ),
    ) as unknown;

    const parsed = parseModuleManifest(raw);

    expect(parsed.ok).toBe(true);
  });

  it('accepts the checked-in storage-s3 manifest without local rewrites', () => {
    const raw = JSON.parse(
      readFileSync(
        join(process.cwd(), '..', '..', '..', '..', 'modules', 'storage', 's3', 'module.json'),
        'utf8',
      ),
    ) as unknown;

    const parsed = parseModuleManifest(raw);

    expect(parsed.ok).toBe(true);
  });

  it('every identity vendor declares client.contract = "identity"', () => {
    for (const moduleDir of ['auth0', 'clerk', 'workos']) {
      const raw = JSON.parse(
        readFileSync(
          join(process.cwd(), '..', '..', '..', '..', 'modules', 'identity', moduleDir, 'module.json'),
          'utf8',
        ),
      ) as { category?: string; client?: { contract?: string } };
      if (raw.category !== 'identity') continue;
      if (!raw.client) continue;
      expect(raw.client?.contract, `modules/identity/${moduleDir}/module.json client.contract`).toBe('identity');
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

describe('ModuleManifestSchema — provisioner block', () => {
  const baseManifest = {
    name: 'identity-auth0',
    version: '1.0.0',
    category: 'identity',
    vendor: 'auth0',
    contract: 'identity/v1',
    capabilities: { rpcs: ['GetUser'], events: [] },
  };

  it('accepts a valid provisioner block', () => {
    const parsed = parseModuleManifest({
      ...baseManifest,
      provisioner: {
        entry: './dist/provisioner.js',
        produces: [
          { name: 'spaClient', kind: 'single', secret: false },
          { name: 'm2mClients', kind: 'many', secret: true },
        ],
        requires: [{ name: 'auth0Mgmt', schema: 'auth0-mgmt-api-v1' }],
        timeoutMs: 30000,
      },
    });
    expect(parsed.ok).toBe(true);
  });

  it('rejects empty produces array', () => {
    const parsed = parseModuleManifest({
      ...baseManifest,
      provisioner: { entry: './dist/provisioner.js', produces: [] },
    });
    expect(parsed.ok).toBe(false);
  });

  it('rejects duplicate produces names', () => {
    const parsed = parseModuleManifest({
      ...baseManifest,
      provisioner: {
        entry: './dist/provisioner.js',
        produces: [
          { name: 'spaClient', kind: 'single', secret: false },
          { name: 'spaClient', kind: 'single', secret: true },
        ],
      },
    });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.errors.some((e) => e.message.includes('PROVISIONER_DUPLICATE_PRODUCES'))).toBe(true);
    }
  });

  it('rejects duplicate requires names', () => {
    const parsed = parseModuleManifest({
      ...baseManifest,
      provisioner: {
        entry: './dist/provisioner.js',
        produces: [{ name: 'a', kind: 'single', secret: false }],
        requires: [
          { name: 'auth0Mgmt', schema: 'auth0-mgmt-api-v1' },
          { name: 'auth0Mgmt', schema: 'something-else' },
        ],
      },
    });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.errors.some((e) => e.message.includes('PROVISIONER_DUPLICATE_REQUIRES'))).toBe(true);
    }
  });

  it('rejects unknown kind', () => {
    const parsed = parseModuleManifest({
      ...baseManifest,
      provisioner: {
        entry: './dist/provisioner.js',
        produces: [{ name: 'a', kind: 'list', secret: false }],
      },
    });
    expect(parsed.ok).toBe(false);
  });

  it('rejects empty entry', () => {
    const parsed = parseModuleManifest({
      ...baseManifest,
      provisioner: {
        entry: '',
        produces: [{ name: 'a', kind: 'single', secret: false }],
      },
    });
    expect(parsed.ok).toBe(false);
  });

  it('treats provisioner block as optional', () => {
    const parsed = parseModuleManifest(baseManifest);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.provisioner).toBeUndefined();
    }
  });
});

describe('ClientBlockSchema — contract field', () => {
  const baseClient = {
    name: '@rntme/identity-test',
    version: '0.0.0',
    client: {
      entry: './client/index.ts',
      boot: true,
    },
  };

  it('accepts contract: "identity"', () => {
    const r = parseModuleManifest({
      ...baseClient,
      client: { ...baseClient.client, contract: 'identity' },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.client?.contract).toBe('identity');
    }
  });

  it('accepts contract: "storage"', () => {
    const r = parseModuleManifest({
      ...baseClient,
      client: { ...baseClient.client, contract: 'storage' },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.client?.contract).toBe('storage');
    }
  });

  it('rejects unknown contract values like "analytics"', () => {
    const r = parseModuleManifest({
      ...baseClient,
      client: { ...baseClient.client, contract: 'analytics' },
    });
    expect(r.ok).toBe(false);
  });

  it('accepts client block without contract (field is optional)', () => {
    const r = parseModuleManifest(baseClient);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.client?.contract).toBeUndefined();
    }
  });
});

describe('capabilities.edgeAuth', () => {
  it('parses introspection-sidecar with full descriptor', () => {
    const result = parseModuleManifest({
      name: 'test',
      version: '1.0.0',
      capabilities: {
        rpcs: ['IntrospectSession'],
        events: [],
        edgeAuth: {
          kind: 'introspection-sidecar',
          transport: 'http',
          method: 'GET',
          path: '/introspect',
          port: 50052,
        },
      },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.capabilities?.edgeAuth?.kind).toBe('introspection-sidecar');
      expect(result.value.capabilities?.edgeAuth?.port).toBe(50052);
    }
  });

  it('rejects unknown edgeAuth.kind', () => {
    const result = parseModuleManifest({
      name: 'test',
      version: '1.0.0',
      capabilities: {
        rpcs: ['IntrospectSession'],
        events: [],
        edgeAuth: {
          kind: 'native-jwt-validation',
          transport: 'http',
          method: 'GET',
          path: '/introspect',
          port: 50052,
        },
      },
    });
    expect(result.ok).toBe(false);
  });

  it('rejects port outside 1..65535', () => {
    const result = parseModuleManifest({
      name: 'test',
      version: '1.0.0',
      capabilities: {
        rpcs: ['IntrospectSession'],
        events: [],
        edgeAuth: {
          kind: 'introspection-sidecar',
          transport: 'http',
          method: 'GET',
          path: '/introspect',
          port: 0,
        },
      },
    });
    expect(result.ok).toBe(false);
  });
});
