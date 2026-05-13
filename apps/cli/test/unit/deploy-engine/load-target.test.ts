import { describe, expect, it } from 'bun:test';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { loadTargetFile } from '../../../src/deploy-engine/load-target.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(here, '..', '..', 'fixtures', 'target-dokploy.json');
const platformFixturePath = join(here, '..', '..', 'fixtures', 'target-platform.json');

describe('loadTargetFile', () => {
  it('parses a valid dokploy target file into a normalized target', async () => {
    const result = await loadTargetFile(fixturePath, 'preview');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.target.slug).toBe('preview');
      expect(result.value.target.kind).toBe('dokploy');
      expect(result.value.target.dokployUrl).toBe('https://dokploy.example.com');
      expect(result.value.secretRefs.apiToken.source).toBe('env');
      expect(result.value.secretRefs.apiToken.name).toBe('DOKPLOY_API_TOKEN');
    }
  });

  it('returns CLI_DEPLOY_TARGET_FILE_INVALID for missing file', async () => {
    const result = await loadTargetFile('/no/such/file.json', 'x');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CLI_DEPLOY_TARGET_FILE_INVALID');
  });

  it('rejects unknown kind', async () => {
    const result = await loadTargetFile(fixturePath, 'preview', {
      readFile: async () => JSON.stringify({ kind: 'mystery', displayName: 'x' }),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CLI_DEPLOY_TARGET_FILE_INVALID');
  });

  it('parses an in-memory event bus target', async () => {
    const result = await loadTargetFile(fixturePath, 'preview', {
      readFile: async () => JSON.stringify({
        kind: 'dokploy',
        displayName: 'preview',
        config: { dokployUrl: 'https://dokploy.example.com' },
        secrets: { apiToken: { source: 'env', name: 'DOKPLOY_API_TOKEN' } },
        eventBus: { kind: 'in-memory' },
      }),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.target.eventBus).toEqual({ kind: 'in-memory' });
  });

  it('accepts module entries with extra facet fields and no image (catchall)', async () => {
    const result = await loadTargetFile(fixturePath, 'preview', {
      readFile: async () =>
        JSON.stringify({
          kind: 'dokploy',
          displayName: 'preview',
          config: { dokployUrl: 'https://dokploy.example.com' },
          secrets: { apiToken: { source: 'env', name: 'DOKPLOY_API_TOKEN' } },
          eventBus: { kind: 'in-memory' },
          modules: {
            marketing: { primaryDomain: 'marketing.example.test' },
            'storage-s3': { image: 'ghcr.io/acme/storage-s3:1.0.0', notes: 'pinned' },
          },
        }),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const t = result.value.target as {
      readonly modules: Record<string, Record<string, unknown>>;
    };
    expect(t.modules.marketing).toEqual({ primaryDomain: 'marketing.example.test' });
    expect(t.modules['storage-s3']?.image).toBe('ghcr.io/acme/storage-s3:1.0.0');
    expect(t.modules['storage-s3']?.notes).toBe('pinned');
  });

  it('parses provisioned RustFS storage into the normalized direct target', async () => {
    const result = await loadTargetFile(fixturePath, 'preview', {
      readFile: async () =>
        JSON.stringify({
          kind: 'dokploy',
          displayName: 'preview',
          config: { dokployUrl: 'https://dokploy.example.com' },
          secrets: { apiToken: { source: 'env', name: 'DOKPLOY_API_TOKEN' } },
          eventBus: { kind: 'in-memory' },
          storage: {
            mode: 'provisioned',
            provider: 'rustfs',
            image: 'rustfs/rustfs:1.0.0',
            publicBaseUrl: 'https://files.example.test',
            accessKeyRef: 'rustfs-access-key',
            secretKeyRef: 'rustfs-secret-key',
          },
        }),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.target.storage).toEqual({
      mode: 'provisioned',
      provider: 'rustfs',
      image: 'rustfs/rustfs:1.0.0',
      publicBaseUrl: 'https://files.example.test',
      accessKeyRef: 'rustfs-access-key',
      secretKeyRef: 'rustfs-secret-key',
    });
  });

  it('parses workflows + auth + nested extras into a normalized platform target', async () => {
    const result = await loadTargetFile(platformFixturePath, 'rntme-platform-prod');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const t = result.value.target as {
      readonly auth: { readonly auth0?: { readonly domain?: string; readonly audience?: string; readonly redirectUri?: string; readonly clientId?: string } };
      readonly workflows: { readonly engine: { readonly kind: string; readonly mode: string; readonly image: string } } | null;
      readonly eventBus: { readonly mode: string; readonly provider?: string };
      readonly publicBaseUrl: string | null;
      readonly modules: Record<string, { readonly image: string; readonly env?: Record<string, string> }>;
      readonly policyValues: Record<string, Record<string, unknown>>;
    };
    expect(t.workflows).not.toBeNull();
    expect(t.workflows?.engine.kind).toBe('operaton');
    expect(t.workflows?.engine.mode).toBe('provisioned');
    expect(t.workflows?.engine.image).toBe('operaton/operaton:2.1.0');
    expect(t.auth.auth0?.domain).toBe('demo-rntme.us.auth0.com');
    expect(t.auth.auth0?.audience).toBe('https://platform.rntme.com/api');
    expect(t.auth.auth0?.redirectUri).toBe('https://platform.rntme.com/auth/callback');
    expect(t.auth.auth0?.clientId).toBe('');
    expect(t.eventBus.mode).toBe('provisioned');
    expect(t.eventBus.provider).toBe('redpanda');
    expect(t.publicBaseUrl).toBe('https://platform.rntme.com');
    expect(t.modules['identity-auth0']).toEqual({
      image: 'ghcr.io/vladprrs/rntme-identity-auth0:identity-auth0-rnt-364-36d8743',
      env: { AUTH0_DOMAIN: 'demo-rntme.us.auth0.com' },
    });
    expect(t.policyValues.requestContext?.default).toEqual({});
    expect(result.value.configOverrides.runtimeImage).toBe(
      'ghcr.io/vladprrs/rntme-runtime:runtime-pr108-27c70ad',
    );

    const extras = result.value.secretRefs.extras as Record<
      string,
      { readonly source?: string; readonly name?: string } | Record<string, { readonly source: string; readonly name: string }>
    >;
    const auth0Mgmt = extras['auth0Mgmt'] as Record<string, { readonly source: string; readonly name: string }>;
    expect(auth0Mgmt.tenantDomain?.name).toBe('AUTH0_DOMAIN');
    expect(auth0Mgmt.mgmtClientId?.name).toBe('AUTH0_MANAGEMENT_CLIENT_ID');
    expect(auth0Mgmt.mgmtClientSecret?.name).toBe('AUTH0_MANAGEMENT_CLIENT_SECRET');
  });
});
