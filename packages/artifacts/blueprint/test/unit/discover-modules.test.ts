import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'bun:test';
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
  it('accepts module project keys that match the manifest vendor', async () => {
    const projectDir = await mkTempProject({
      'project.json': JSON.stringify({
        name: 'demo',
        modules: { openrouter: { package: '@rntme/ai-llm-openrouter' } },
      }),
      'node_modules/@rntme/ai-llm-openrouter/module.json': JSON.stringify({
        name: '@rntme/ai-llm-openrouter',
        version: '1.0.0',
        category: 'ai-llm',
        vendor: 'openrouter',
        contract: 'ai-llm/v1',
        capabilities: { vendors: ['openrouter'], rpcs: ['Complete'], events: [] },
      }),
    });

    const result = await discoverModules({ projectDir });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value['@rntme/ai-llm-openrouter']?.projectKey).toBe('openrouter');
    }
  });

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
    const result = await discoverModules({ projectDir });
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
    const result = await discoverModules({ projectDir });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'BLUEPRINT_MODULE_PROVISIONER_BAD_ENTRY')).toBe(true);
    }
  });

  it('resolves snake-case workspace aliases like rntme_<category>_<vendor>', async () => {
    // Build a fake monorepo: project lives at projectDir/dist/blueprint,
    // and the module is checked out at projectDir/modules/identity/auth0.
    // workspacePackageDir's first candidate root is `<projectDir>/../..` so
    // both files share the same top-level dir.
    const root = mkdtempSync(join(tmpdir(), 'rntme-blueprint-alias-'));
    const projectDir = join(root, 'dist', 'blueprint');
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(
      join(projectDir, 'project.json'),
      JSON.stringify({
        name: 'demo',
        modules: { identity: { package: 'rntme_identity_auth0' } },
      }),
      'utf-8',
    );
    const moduleDir = join(root, 'modules', 'identity', 'auth0');
    mkdirSync(moduleDir, { recursive: true });
    writeFileSync(
      join(moduleDir, 'module.json'),
      JSON.stringify({
        name: '@rntme/identity-auth0',
        version: '1.0.0',
        category: 'identity',
        vendor: 'auth0',
        contract: 'identity/v1',
        capabilities: { rpcs: ['GetUser'], events: [] },
      }),
      'utf-8',
    );

    const result = await discoverModules({ projectDir });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value['@rntme/identity-auth0']?.projectKey).toBe('identity');
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
    const result = await discoverModules({ projectDir });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'BLUEPRINT_MODULE_PROVISIONER_BAD_ENTRY')).toBe(true);
    }
  });
});
