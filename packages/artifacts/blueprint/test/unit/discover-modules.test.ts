import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { discoverModules } from '../../src/compose/modules.js';

/**
 * Create a temporary project directory with the given file tree.
 * Keys are relative paths; values are file contents.
 */
async function mkTempProject(files: Record<string, string>): Promise<string> {
  const projectDir = mkdtempSync(join(tmpdir(), 'rntme-blueprint-'));
  for (const [relPath, content] of Object.entries(files)) {
    const fullPath = join(projectDir, relPath);
    mkdirSync(join(fullPath, '..'), { recursive: true });
    writeFileSync(fullPath, content, 'utf-8');
  }
  return projectDir;
}

describe('discoverModules — provisioner block', () => {
  it('surfaces provisioner block on DiscoveredModule', async () => {
    const projectDir = await mkTempProject({
      'project.json': JSON.stringify({
        name: 'demo',
        modules: { identity: { package: '@rntme/identity-auth0' } },
      }),
      'node_modules/@rntme/identity-auth0/module.json': JSON.stringify({
        name: '@rntme/identity-auth0',
        version: '1.0.0',
        category: 'identity',
        vendor: 'auth0',
        contract: 'identity/v1',
        capabilities: { rpcs: ['GetUser'], events: [] },
        provisioner: {
          entry: './dist/provisioner.js',
          produces: [{ name: 'spaClient', kind: 'single', secret: false }],
          requires: [{ name: 'auth0Mgmt', schema: 'auth0-mgmt-api-v1' }],
        },
      }),
    });
    const result = discoverModules({ projectDir });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const m = result.value['@rntme/identity-auth0'];
      expect(m?.manifest.provisioner).toEqual({
        entry: './dist/provisioner.js',
        produces: [{ name: 'spaClient', kind: 'single', secret: false }],
        requires: [{ name: 'auth0Mgmt', schema: 'auth0-mgmt-api-v1' }],
      });
    }
  });

  it('rejects absolute provisioner entry', async () => {
    const projectDir = await mkTempProject({
      'project.json': JSON.stringify({
        name: 'demo',
        modules: { identity: { package: '@rntme/identity-auth0' } },
      }),
      'node_modules/@rntme/identity-auth0/module.json': JSON.stringify({
        name: '@rntme/identity-auth0',
        version: '1.0.0',
        category: 'identity',
        vendor: 'auth0',
        contract: 'identity/v1',
        capabilities: { rpcs: ['GetUser'], events: [] },
        provisioner: {
          entry: '/absolute/path/provisioner.js',
          produces: [{ name: 'a', kind: 'single', secret: false }],
        },
      }),
    });
    const result = discoverModules({ projectDir });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'BLUEPRINT_MODULE_PROVISIONER_BAD_ENTRY')).toBe(true);
    }
  });

  it('rejects parent-traversal provisioner entry', async () => {
    const projectDir = await mkTempProject({
      'project.json': JSON.stringify({
        name: 'demo',
        modules: { identity: { package: '@rntme/identity-auth0' } },
      }),
      'node_modules/@rntme/identity-auth0/module.json': JSON.stringify({
        name: '@rntme/identity-auth0',
        version: '1.0.0',
        category: 'identity',
        vendor: 'auth0',
        contract: 'identity/v1',
        capabilities: { rpcs: ['GetUser'], events: [] },
        provisioner: {
          entry: '../escapes/provisioner.js',
          produces: [{ name: 'a', kind: 'single', secret: false }],
        },
      }),
    });
    const result = discoverModules({ projectDir });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'BLUEPRINT_MODULE_PROVISIONER_BAD_ENTRY')).toBe(true);
    }
  });
});
