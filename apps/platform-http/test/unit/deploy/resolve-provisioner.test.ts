import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { buildResolveProvisioner } from '../../../src/app.js';

describe('buildResolveProvisioner', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'rntme-rp-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('imports the provisioner entry from the synthetic path', async () => {
    const safePath = join(dir, 'assets/provisioners/test__example.entry.js');
    mkdirSync(join(dir, 'assets/provisioners'), { recursive: true });
    writeFileSync(safePath, 'export const provision = () => "p";\nexport const tearDown = () => "t";\n');

    const resolve = buildResolveProvisioner();
    const contract = await resolve('@test/example', './ignored.js', dir);
    expect(typeof contract.provision).toBe('function');
    expect(typeof contract.tearDown).toBe('function');
  });

  it('throws DEPLOY_PROVISION_BUNDLE_ASSET_MISSING when the file is absent', async () => {
    const resolve = buildResolveProvisioner();
    await expect(resolve('@test/missing', './ignored.js', dir))
      .rejects.toThrow(/DEPLOY_PROVISION_BUNDLE_ASSET_MISSING/);
  });

  it('throws DEPLOY_PROVISION_ENTRY_LOAD_FAILED when JS is broken', async () => {
    const safePath = join(dir, 'assets/provisioners/broken.entry.js');
    mkdirSync(join(dir, 'assets/provisioners'), { recursive: true });
    writeFileSync(safePath, 'this is not valid javascript {{{');

    const resolve = buildResolveProvisioner();
    await expect(resolve('broken', './ignored.js', dir))
      .rejects.toThrow(/DEPLOY_PROVISION_ENTRY_LOAD_FAILED/);
  });
});
