import { describe, expect, it } from 'bun:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtempSync } from 'node:fs';
import { createCliResolveProvisioner } from '../../../src/deploy-engine/resolve-provisioner.js';

describe('createCliResolveProvisioner', () => {
  it('throws when the provisioner package cannot be resolved from bundleDir', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cli-resolveprov-'));
    const resolve = createCliResolveProvisioner();
    await expect(resolve('definitely-not-installed', './provisioner.js', dir)).rejects.toThrow();
  });
});
