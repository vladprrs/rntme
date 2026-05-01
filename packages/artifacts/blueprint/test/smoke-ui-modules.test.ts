import { describe, expect, it } from 'vitest';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadComposedBlueprint } from '../src/compose/load-composed-blueprint.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, 'fixtures', 'ui-modules-project');

describe('loadComposedBlueprint (UI modules)', () => {
  it('discovers modules, validates UI with catalog, emits virtual entry + publicConfig', () => {
    const r = loadComposedBlueprint(fixtureDir);
    expect(r.ok, r.ok ? '' : JSON.stringify(r.errors)).toBe(true);
    if (!r.ok) return;

    expect(r.value.catalogManifest).not.toBeNull();
    const types = r.value.catalogManifest!.components.map((c) => c.type).sort();
    expect(types).toContain('Markdown');
    expect(types).toContain('Mermaid');
    expect(types).toContain('RichTextEditor');
    expect(r.value.catalogManifest!.categoryToModule.analytics).toBe('@rntme/analytics-google-analytics');
    expect(r.value.catalogManifest!.publicConfig['@rntme/analytics-google-analytics']).toEqual({
      measurementId: 'G-INTEGRATION',
    });

    expect(r.value.publicConfigJson).toContain('G-INTEGRATION');
    expect(r.value.virtualEntrySource).toContain('@rntme/presentation-md-mermaid/client');
    expect(r.value.virtualEntrySource).toContain('@rntme/presentation-tiptap/client');
    expect(r.value.virtualEntrySource).toContain('@rntme/analytics-google-analytics/client');
    expect(r.value.virtualEntrySource).toContain('hydrateApp');
    expect(r.value.virtualEntrySource).toContain('moduleCatalogComponents: rntmeModuleCatalogComponents');
    expect(r.value.virtualEntrySource).toContain('"source":{"type":"string","required":true}');

    expect(r.value.services.app?.compiledUi?.screens.home).toBeDefined();
  });
});
