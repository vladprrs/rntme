import { describe, expect, it } from 'bun:test';
import { readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadBlueprintForDeploy } from '../../../src/deploy-engine/load-blueprint.js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..', '..', '..', '..');

describe('loadBlueprintForDeploy', () => {
  it('returns CLI_DEPLOY_BLUEPRINT_INVALID for a non-existent dir', async () => {
    const result = await loadBlueprintForDeploy('/no/such/dir');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CLI_DEPLOY_BLUEPRINT_INVALID');
  });

  it('materializes project-folder assets for direct deploy bundleDir', async () => {
    const result = await loadBlueprintForDeploy(join(repoRoot, 'demo', 'cv-extract-blueprint'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    try {
      const entries = await readdir(join(result.value.bundleDir, 'assets', 'project-folders', 'marketing-site'));
      expect(entries.filter((entry) => /^[0-9a-f]{64}\.tar\.gz$/.test(entry))).toHaveLength(1);
    } finally {
      await result.value.cleanup();
    }
  });
});
