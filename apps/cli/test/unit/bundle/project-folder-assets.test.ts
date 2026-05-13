import { describe, expect, it } from 'bun:test';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectProjectFolderAssets } from '../../../src/bundle/project-folder-assets.js';

function withTmp<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), 'rntme-pfa-'));
  return fn(dir).finally(() => rmSync(dir, { recursive: true, force: true }));
}

describe('collectProjectFolderAssets', () => {
  it('returns {} when project.json has no project-folder sources', async () => {
    await withTmp(async (dir) => {
      const r = await collectProjectFolderAssets(
        dir,
        {
          'project.json': {
            name: 'demo',
            modules: {
              marketing: {
                package: '@rntme/marketing-site-static',
                publicConfig: {
                  source: { kind: 's3', bucket: 'b', key: 'k', sha256: 'a'.repeat(64) },
                },
              },
            },
          },
        },
        { totalBytes: 0 },
        10 * 1024 * 1024,
      );
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value).toEqual({});
    });
  });

  it('packs the referenced folder into assets/project-folders/<moduleKey>/<sha>.tar.gz', async () => {
    await withTmp(async (dir) => {
      mkdirSync(join(dir, 'landing'));
      writeFileSync(join(dir, 'landing', 'index.html'), '<h1>hi</h1>');

      const r = await collectProjectFolderAssets(
        dir,
        {
          'project.json': {
            modules: {
              marketing: {
                publicConfig: { source: { kind: 'project-folder', path: 'landing' } },
              },
            },
          },
        },
        { totalBytes: 0 },
        10 * 1024 * 1024,
      );
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      const keys = Object.keys(r.value);
      expect(keys).toHaveLength(1);
      expect(keys[0]).toMatch(
        /^assets\/project-folders\/marketing\/[0-9a-f]{64}\.tar\.gz$/,
      );
    });
  });

  it('returns deterministic asset path across builds', async () => {
    const make = async (): Promise<string> => {
      return withTmp(async (dir) => {
        mkdirSync(join(dir, 'landing'));
        writeFileSync(join(dir, 'landing', 'index.html'), '<h1>same</h1>');
        const r = await collectProjectFolderAssets(
          dir,
          {
            'project.json': {
              modules: {
                marketing: {
                  publicConfig: { source: { kind: 'project-folder', path: 'landing' } },
                },
              },
            },
          },
          { totalBytes: 0 },
          10 * 1024 * 1024,
        );
        if (!r.ok) throw new Error('expected ok');
        return Object.keys(r.value)[0] ?? '';
      });
    };
    const first = await make();
    const second = await make();
    expect(first).toBe(second);
  });

  it('returns BLUEPRINT_PROJECT_FOLDER_ASSET_MISSING when the folder does not exist', async () => {
    await withTmp(async (dir) => {
      const r = await collectProjectFolderAssets(
        dir,
        {
          'project.json': {
            modules: {
              marketing: { publicConfig: { source: { kind: 'project-folder', path: 'nope' } } },
            },
          },
        },
        { totalBytes: 0 },
        10 * 1024 * 1024,
      );
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors[0]?.code).toBe('BLUEPRINT_PROJECT_FOLDER_ASSET_MISSING');
    });
  });

  it('returns CLI_BUNDLE_ASSETS_TOO_LARGE when packed bytes exceed budget', async () => {
    await withTmp(async (dir) => {
      mkdirSync(join(dir, 'landing'));
      writeFileSync(join(dir, 'landing', 'index.html'), 'x'.repeat(1024));
      const r = await collectProjectFolderAssets(
        dir,
        {
          'project.json': {
            modules: {
              marketing: {
                publicConfig: { source: { kind: 'project-folder', path: 'landing' } },
              },
            },
          },
        },
        { totalBytes: 0 },
        16,
      );
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors[0]?.code).toBe('CLI_BUNDLE_ASSETS_TOO_LARGE');
    });
  });

  it('rejects unsafe module keys', async () => {
    await withTmp(async (dir) => {
      const r = await collectProjectFolderAssets(
        dir,
        {
          'project.json': {
            modules: {
              '../escape': {
                publicConfig: { source: { kind: 'project-folder', path: 'landing' } },
              },
            },
          },
        },
        { totalBytes: 0 },
        10 * 1024 * 1024,
      );
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors[0]?.code).toBe('BLUEPRINT_PROJECT_FOLDER_ASSET_INVALID');
    });
  });
});
