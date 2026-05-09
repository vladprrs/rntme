import { describe, expect, it } from 'vitest';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadComposedBlueprint } from '@rntme/blueprint';

const here = dirname(fileURLToPath(import.meta.url));
const blueprintRoot = join(here, '..');

describe('platform blueprint', () => {
  it('composes the foundation platform blueprint', async () => {
    const result = await loadComposedBlueprint(blueprintRoot);
    expect(result.ok, result.ok ? '' : JSON.stringify(result.errors, null, 2)).toBe(true);
    if (!result.ok) return;

    expect(result.value.project.name).toBe('rntme-platform');
    expect(Object.keys(result.value.services).sort()).toEqual(['audit', 'deployments', 'identity-auth0', 'organizations', 'projects', 'tokens']);
    expect(result.value.bindingRegistry['organizations.listOrganizations']?.path).toBe('/api/organizations');
    expect(result.value.bindingRegistry['projects.listProjects']?.path).toBe('/api/projects');
    expect(result.value.bindingRegistry['tokens.listTokens']?.path).toBe('/api/tokens');
    expect(result.value.bindingRegistry['audit.listAuditEvents']?.path).toBe('/api/audit');
  });
});
