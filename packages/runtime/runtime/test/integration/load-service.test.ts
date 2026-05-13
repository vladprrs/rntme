import { describe, it, expect } from 'bun:test';
import { fileURLToPath } from 'node:url';
import { cpSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { loadService } from '../../src/load/load-service.js';

function writeMinimalRuntimeService(dir: string): void {
  cpSync(fixtureDir, dir, { recursive: true });
}

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, '..', 'fixtures', 'issue-tracker');

describe('loadService (happy path)', () => {
  it('loads the issue-tracker fixture', () => {
    const r = loadService(fixtureDir);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.manifest.service.name).toBe('issue-tracker-api');
    expect(Object.keys(r.value.graphSpec.graphs).length).toBeGreaterThan(0);
    expect(r.value.openApiDoc.openapi).toBe('3.1.0');
    expect(r.value.projectionDdls.length).toBeGreaterThan(0);
    expect(r.value.eventTypes.length).toBeGreaterThan(0);
    expect(r.value.seed).toBeNull();
    expect(r.value.graphSpec.pdmRef).toBe('issue-tracker-api.domain.1.0.0');
    expect(r.value.graphSpec.qsmRef).toBe('issue-tracker-api.read.1.0.0');
  });

  it('sets uiAssetsDir when a ui-build directory exists', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'rntme-runtime-load-'));
    try {
      cpSync(fixtureDir, tmp, { recursive: true });
      mkdirSync(join(tmp, 'ui-build'));
      writeFileSync(join(tmp, 'ui-build', 'main.js'), 'console.log("custom ui");\n');
      writeFileSync(join(tmp, 'ui-build', 'main.css'), ':root { color-scheme: light; }\n');

      const r = loadService(tmp);

      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.value.uiAssetsDir).toBe(join(tmp, 'ui-build'));
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('loads optional ui-assets.json next to runtime artifacts', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'rntme-runtime-load-assets-'));
    try {
      writeMinimalRuntimeService(tmp);
      writeFileSync(join(tmp, 'ui-assets.json'), JSON.stringify({
        stylesheets: [
          {
            id: 'platform-ui',
            moduleKey: 'platformUi',
            moduleName: '@rntme/platform-ui',
            href: '/assets/modules/platformUi/stylesheets/platform-ui.css',
            order: 100,
            media: 'all',
            scope: 'document',
          },
        ],
        fonts: [],
        icons: [],
        images: [],
        staticFiles: [],
        preloads: [],
      }));

      const result = loadService(tmp);

      expect(result.ok, result.ok ? '' : JSON.stringify(result.errors, null, 2)).toBe(true);
      if (result.ok) {
        expect(result.value.uiAssetManifest?.stylesheets[0]?.id).toBe('platform-ui');
      }
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
