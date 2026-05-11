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

  it('parses workflows + auth + nested extras into a normalized platform target', async () => {
    const result = await loadTargetFile(platformFixturePath, 'rntme-platform-prod');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const t = result.value.target as {
      readonly auth: { readonly auth0?: { readonly domain?: string; readonly audience?: string; readonly redirectUri?: string; readonly clientId?: string } };
      readonly workflows: { readonly engine: { readonly kind: string; readonly mode: string; readonly image: string } } | null;
      readonly eventBus: { readonly mode: string; readonly provider?: string };
      readonly publicBaseUrl: string | null;
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
