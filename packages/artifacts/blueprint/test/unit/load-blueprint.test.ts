import { describe, expect, it } from 'vitest';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadBlueprint } from '../../src/load/load-blueprint.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, '..', 'fixtures', 'product-catalog-project');

describe('loadBlueprint', () => {
  it('loads project.json + project pdm + service descriptors', () => {
    const r = loadBlueprint(fixtureDir);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.value.project.name).toBe('product-catalog');
    expect(r.value.pdm.entities.Product?.kind).toBe('root');
    expect(r.value.services['mod-workos']?.kind).toBe('integration');
    expect(r.value.services.catalog?.qsm).not.toBeNull();
  });
});
