import { describe, expect, it } from 'vitest';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadComposedBlueprint } from '../src/compose/load-composed-blueprint.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, 'fixtures', 'product-catalog-project');

describe('loadComposedBlueprint (smoke)', () => {
  it('loads the canonical composed project fixture', () => {
    const r = loadComposedBlueprint(fixtureDir);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.value.project.services).toEqual(['catalog', 'pricing', 'inventory', 'app', 'mod-workos']);
    expect(r.value.routing.httpBaseByService.catalog).toBe('/api/catalog');
    expect(r.value.bindingRegistry['catalog.listProducts']?.path).toBe('/api/catalog/products');
    expect(r.value.services.app?.compiledUi?.screens.home).toBeDefined();
  });
});
