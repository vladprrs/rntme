import { describe, expect, it } from 'bun:test';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadComposedBlueprint } from '../../../../packages/artifacts/blueprint/src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const blueprintRoot = join(here, '..');

describe('platform blueprint', () => {
  it('composes the foundation platform blueprint', async () => {
    const result = await loadComposedBlueprint(blueprintRoot);
    expect(result.ok, result.ok ? '' : JSON.stringify(result.errors, null, 2)).toBe(true);
    if (!result.ok) return;

    expect(result.value.project.name).toBe('rntme-platform');
    expect(Object.keys(result.value.services).sort()).toEqual(['app', 'audit', 'deployments', 'identity-auth0', 'organizations', 'projects', 'tokens']);
    expect(result.value.bindingRegistry['organizations.listOrganizations']?.path).toBe('/api/organizations');
    expect(result.value.bindingRegistry['projects.listProjects']?.path).toBe('/api/projects');
    expect(result.value.bindingRegistry['tokens.listTokens']?.path).toBe('/api/tokens');
    expect(result.value.bindingRegistry['audit.listAuditEvents']?.path).toBe('/api/audit');
  });

  it('uses multi-provider edge auth with platform-tokens first', async () => {
    const result = await loadComposedBlueprint(join(here, '..'));
    expect(result.ok, result.ok ? '' : JSON.stringify(result.errors, null, 2)).toBe(true);
    if (!result.ok) return;

    expect(result.value.project.middleware?.auth).toEqual({
      kind: 'auth',
      providers: [
        {
          provider: 'platform-tokens',
          moduleSlug: 'tokens',
          introspectPath: '/api/tokens/introspect',
          introspectPort: 3000,
        },
        {
          provider: 'auth0',
          audience: '${AUTH0_AUDIENCE}',
          moduleSlug: 'identity-auth0',
        },
      ],
    });
    expect(result.value.bindingRegistry['tokens.introspectToken']?.path).toBe('/api/tokens/introspect');
  });

  it('mounts an edge body limit for project bundle publishing', async () => {
    const result = await loadComposedBlueprint(join(here, '..'));
    expect(result.ok, result.ok ? '' : JSON.stringify(result.errors, null, 2)).toBe(true);
    if (!result.ok) return;

    expect(result.value.project.middleware?.projectBundleBodyLimit).toEqual({
      kind: 'body-limit',
      policy: 'projectBundle',
    });
    expect(result.value.project.mounts?.find((mount) => mount.target === 'http:/api/projects')?.use).toEqual([
      'requestContext',
      'projectBundleBodyLimit',
      'auth',
    ]);
  });

  it('declares IntrospectToken as a service operation in services/tokens/operations.json', async () => {
    const manifestPath = join(here, '../services/tokens/operations.json');
    expect(existsSync(manifestPath)).toBe(true);
    const raw = await readFile(manifestPath, 'utf8');
    const parsed = JSON.parse(raw);
    expect(parsed.version).toBe('1');
    expect(parsed.operations).toBeDefined();
    expect(parsed.operations.IntrospectToken).toEqual({
      handler: { kind: 'native', entry: './handlers/introspect-token.ts', export: 'introspectTokenHandler' },
      input: { bearerToken: { type: 'string', mode: 'defaulted', default: null } },
      output: { type: 'IntrospectTokenResult' },
      effect: 'read',
      idempotency: 'none',
    });
    const handlerPath = join(here, '../services/tokens/handlers/introspect-token.ts');
    expect(existsSync(handlerPath)).toBe(true);
  });

  it('lets token introspection map a missing Authorization header to a typed auth error', async () => {
    const bindingsPath = join(here, '../services/tokens/bindings/bindings.json');
    const raw = await readFile(bindingsPath, 'utf8');
    const parsed = JSON.parse(raw);
    expect(parsed.bindings.introspectToken.inputFrom.bearerToken).toEqual({
      from: 'header',
      name: 'authorization',
      required: false,
    });
  });
});
