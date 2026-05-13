// demo/cv-extract-blueprint/test/landing-deploy.test.ts
//
// Smoke test that the cv-extract demo bundle packs its `landing` project
// folder into a deterministic marketing-site asset and leaves
// `project.json` source declarations untouched.
import { describe, expect, it } from 'bun:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildProjectBundle } from '../../../apps/cli/src/bundle/build.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

describe('cv-extract demo: landing deploy packing', () => {
  it('packs the landing folder as a single project-folder asset', { timeout: 30000 }, async () => {
    const built = await buildProjectBundle(ROOT);
    expect(built.ok).toBe(true);
    if (!built.ok) return;

    const projectFolderKeys = Object.keys(built.value.bundle.assets).filter((key) =>
      key.startsWith('assets/project-folders/'),
    );
    expect(projectFolderKeys).toHaveLength(1);
    expect(projectFolderKeys[0]).toMatch(
      /^assets\/project-folders\/marketing-site\/[0-9a-f]{64}\.tar\.gz$/,
    );
  });

  it('preserves the canonical project-folder source declaration in project.json', { timeout: 30000 }, async () => {
    const built = await buildProjectBundle(ROOT);
    expect(built.ok).toBe(true);
    if (!built.ok) return;

    const projectJson = built.value.bundle.files['project.json'] as {
      modules: { 'marketing-site': { publicConfig: { source: { kind: string; path: string } } } };
    };
    expect(projectJson.modules['marketing-site'].publicConfig.source).toEqual({
      kind: 'project-folder',
      path: 'landing',
    });
  });
});
