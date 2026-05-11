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

  it('declares IntrospectToken as a service operation in services/tokens/operations.json', async () => {
    const manifestPath = join(here, '../services/tokens/operations.json');
    expect(existsSync(manifestPath)).toBe(true);
    const raw = await readFile(manifestPath, 'utf8');
    const parsed = JSON.parse(raw);
    expect(parsed.version).toBe('1');
    expect(parsed.operations).toBeDefined();
    expect(parsed.operations.IntrospectToken).toEqual({
      handler: { kind: 'native', entry: './handlers/introspect-token.ts', export: 'introspectTokenHandler' },
      input: { bearerToken: { type: 'string', mode: 'required' } },
      output: { type: 'IntrospectTokenResult' },
      effect: 'read',
      idempotency: 'none',
    });
    const handlerPath = join(here, '../services/tokens/handlers/introspect-token.ts');
    expect(existsSync(handlerPath)).toBe(true);
  });
});
