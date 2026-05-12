import { describe, expect, it } from 'bun:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { createCliResolveProvisioner } from '../../../src/deploy-engine/resolve-provisioner.js';

describe('createCliResolveProvisioner', () => {
  it('resolves provisioner entries from a bundled provisioner manifest', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cli-resolveprov-'));
    const provisionerDir = join(dir, '.provisioners', 'rntme__identity-auth0');
    mkdirSync(provisionerDir, { recursive: true });
    writeFileSync(
      join(dir, '.provisioners', 'manifest.json'),
      JSON.stringify({
        entries: {
          '@rntme/identity-auth0::./dist/provisioner.entry.js':
            '.provisioners/rntme__identity-auth0/provisioner.entry.js',
        },
      }),
    );
    writeFileSync(
      join(provisionerDir, 'provisioner.entry.js'),
      'export default { provision: async () => ({ ok: true, value: { publicByModule: {}, secretByModule: {} } }) };\n',
    );

    const resolve = createCliResolveProvisioner();
    const provisioner = await resolve('@rntme/identity-auth0', './dist/provisioner.entry.js', dir);

    expect(typeof provisioner.provision).toBe('function');
  });

  it('throws when the provisioner package cannot be resolved from bundleDir', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cli-resolveprov-'));
    const resolve = createCliResolveProvisioner();
    await expect(resolve('definitely-not-installed', './provisioner.js', dir)).rejects.toThrow();
  });
});
