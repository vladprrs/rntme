import { describe, expect, it } from 'bun:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadBlueprint } from '../src/load/load-blueprint.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, 'fixtures', 'product-catalog-project');

describe('loadBlueprint (smoke)', () => {
  it('loads the canonical product-catalog project fixture', async () => {
    const r = await loadBlueprint(fixtureDir);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.value.project.services).toEqual([
      'catalog',
      'pricing',
      'inventory',
      'app',
      'mod-workos',
    ]);
    expect(r.value.pdm.entities.Product?.kind).toBe('root');
    expect(r.value.services.catalog?.qsm).not.toBeNull();
    expect(r.value.services['mod-workos']?.kind).toBe('integration');
  });
});
