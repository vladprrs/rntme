import { describe, expect, it } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DiscoveredProvisionerModule } from '@rntme/deploy-core';
import { materializeProjectFolderAssets } from '../src/project-assets.js';

function withTmp(fn: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), 'rntme-pf-mat-'));
  try {
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const sha = '0'.repeat(64);

function moduleWithSource(
  source: Record<string, unknown> | undefined,
): DiscoveredProvisionerModule {
  return {
    projectKey: 'marketing',
    packageName: '@rntme/marketing-site-static',
    manifest: {
      name: '@rntme/marketing-site-static',
      version: '0.0.0',
      provisioner: {
        entry: './dist/provisioner.entry.js',
        produces: [{ name: 'url', kind: 'single', secret: false }],
        requires: [],
      },
    },
    publicConfig: source === undefined ? {} : { source },
  };
}

describe('materializeProjectFolderAssets', () => {
  it('rewrites project-folder source to materialized-project-asset with localPath + sha', () => {
    withTmp((dir) => {
      const dest = join(dir, 'assets', 'project-folders', 'marketing');
      mkdirSync(dest, { recursive: true });
      writeFileSync(join(dest, `${sha}.tar.gz`), Buffer.from('fake'));

      const out = materializeProjectFolderAssets({
        bundleDir: dir,
        modules: [moduleWithSource({ kind: 'project-folder', path: 'landing' })],
      });

      expect(out.errors).toEqual([]);
      const first = out.modules[0];
      expect(first?.publicConfig.source).toEqual({
        kind: 'materialized-project-asset',
        assetPath: `assets/project-folders/marketing/${sha}.tar.gz`,
        localPath: join(dir, 'assets/project-folders/marketing', `${sha}.tar.gz`),
        sha256: sha,
      });
    });
  });

  it('passes non-project-folder sources through unchanged', () => {
    withTmp((dir) => {
      const original = { kind: 's3', bucket: 'b', key: 'k', sha256: sha };
      const out = materializeProjectFolderAssets({
        bundleDir: dir,
        modules: [moduleWithSource(original)],
      });
      expect(out.errors).toEqual([]);
      expect(out.modules[0]?.publicConfig.source).toEqual(original);
    });
  });

  it('returns DEPLOY_PROVISION_PROJECT_FOLDER_ASSET_MISSING when no matching asset exists', () => {
    withTmp((dir) => {
      const out = materializeProjectFolderAssets({
        bundleDir: dir,
        modules: [moduleWithSource({ kind: 'project-folder', path: 'landing' })],
      });
      expect(out.modules).toEqual([]);
      expect(out.errors[0]?.code).toBe('DEPLOY_PROVISION_PROJECT_FOLDER_ASSET_MISSING');
    });
  });

  it('skips modules whose publicConfig has no source key', () => {
    withTmp((dir) => {
      const out = materializeProjectFolderAssets({
        bundleDir: dir,
        modules: [moduleWithSource(undefined)],
      });
      expect(out.errors).toEqual([]);
      expect(out.modules[0]?.publicConfig).toEqual({});
    });
  });
});
