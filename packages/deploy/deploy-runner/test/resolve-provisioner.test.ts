import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'bun:test';

import { buildResolveProvisioner } from '../src/resolve-provisioner.js';

const tmpDirs: string[] = [];

function mkProject(): string {
  const dir = mkdtempSync(join(tmpdir(), 'rntme-resolve-provisioner-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(async () => {
  for (const d of tmpDirs.splice(0)) {
    await rm(d, { recursive: true, force: true }).catch(() => undefined);
  }
});

describe('buildResolveProvisioner', () => {
  it('loads a bundle-asset provisioner when bundleAssetDir is configured', async () => {
    const dir = mkProject();
    const bundleAssetDir = join(dir, 'assets', 'provisioners');
    mkdirSync(bundleAssetDir, { recursive: true });
    writeFileSync(
      join(bundleAssetDir, 'rntme__identity-auth0.entry.js'),
      'export async function provision() { return { source: "bundle-asset" }; }\n',
      'utf8',
    );

    const resolve = buildResolveProvisioner({ bundleAssetDir: 'assets/provisioners' });
    const provisioner = await resolve('@rntme/identity-auth0', 'dist/provisioner.entry.js', dir);
    const provision = provisioner.provision as unknown as () => Promise<Record<string, unknown>>;
    expect(typeof provision).toBe('function');
    expect(await provision()).toEqual({ source: 'bundle-asset' });
  });

  it('loads a manifest-bundled provisioner when manifestPath is configured', async () => {
    const dir = mkProject();
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
      'utf8',
    );
    writeFileSync(
      join(provisionerDir, 'provisioner.entry.js'),
      'export default { provision: async () => ({ source: "manifest" }) };\n',
      'utf8',
    );

    const resolve = buildResolveProvisioner({ manifestPath: '.provisioners/manifest.json' });
    const provisioner = await resolve(
      '@rntme/identity-auth0',
      './dist/provisioner.entry.js',
      dir,
    );
    const provision = provisioner.provision as unknown as () => Promise<Record<string, unknown>>;
    expect(typeof provision).toBe('function');
    expect(await provision()).toEqual({ source: 'manifest' });
  });

  it('rejects manifest entries that escape the manifest directory (path traversal)', async () => {
    const dir = mkProject();
    mkdirSync(join(dir, '.provisioners'), { recursive: true });
    // Write an attacker file outside .provisioners/.
    writeFileSync(join(dir, 'attacker.js'), 'export default {};\n', 'utf8');
    writeFileSync(
      join(dir, '.provisioners', 'manifest.json'),
      JSON.stringify({
        entries: {
          '@rntme/identity-auth0::./dist/provisioner.entry.js': '../attacker.js',
        },
      }),
      'utf8',
    );

    const resolve = buildResolveProvisioner({
      manifestPath: '.provisioners/manifest.json',
      errorCodePrefix: 'CLI_DEPLOY_PROVISIONER',
    });
    await expect(
      resolve('@rntme/identity-auth0', './dist/provisioner.entry.js', dir),
    ).rejects.toThrow(/CLI_DEPLOY_PROVISIONER_MANIFEST_PATH_INVALID:@rntme\/identity-auth0/);
  });

  it('rejects installed-package entries that escape the package root (path traversal)', async () => {
    const dir = mkProject();
    const packageDir = join(dir, 'node_modules', '@rntme', 'identity-auth0');
    mkdirSync(packageDir, { recursive: true });
    writeFileSync(
      join(packageDir, 'package.json'),
      JSON.stringify({
        name: '@rntme/identity-auth0',
        type: 'module',
        exports: { './package.json': './package.json' },
      }),
      'utf8',
    );

    const resolve = buildResolveProvisioner({
      errorCodePrefix: 'CLI_DEPLOY_PROVISIONER',
    });
    await expect(
      resolve('@rntme/identity-auth0', '../escape.js', dir),
    ).rejects.toThrow(/CLI_DEPLOY_PROVISIONER_ENTRY_PATH_INVALID:\.\.\/escape\.js/);
  });

  it('falls through to installed-package layout when no options match', async () => {
    const dir = mkProject();
    const packageDir = join(dir, 'node_modules', '@rntme', 'storage-s3');
    mkdirSync(join(packageDir, 'dist'), { recursive: true });
    writeFileSync(
      join(packageDir, 'package.json'),
      JSON.stringify({
        name: '@rntme/storage-s3',
        type: 'module',
        exports: {
          './provisioner.entry': { import: './dist/provisioner.entry.js' },
          './package.json': './package.json',
        },
      }),
      'utf8',
    );
    writeFileSync(
      join(packageDir, 'dist', 'provisioner.entry.js'),
      'export default { provision: async () => ({ source: "installed" }) };\n',
      'utf8',
    );

    const resolve = buildResolveProvisioner();
    const provisioner = await resolve('@rntme/storage-s3', './dist/provisioner.entry.js', dir);
    const provision = provisioner.provision as unknown as () => Promise<Record<string, unknown>>;
    expect(typeof provision).toBe('function');
    expect(await provision()).toEqual({ source: 'installed' });
  });

  it('throws when no provisioner can be resolved', async () => {
    const dir = mkProject();
    const resolve = buildResolveProvisioner();
    await expect(
      resolve('@rntme/does-not-exist', './provisioner.js', dir),
    ).rejects.toThrow();
  });
});
