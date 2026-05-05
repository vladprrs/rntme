import { describe, expect, it } from 'vitest';
import { cpSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadBlueprint } from '../../src/load/load-blueprint.js';
import { ERROR_CODES } from '../../src/types/result.js';

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

  it('rejects a malformed service.json with a descriptor-specific load error', () => {
    const temp = mkdtempSync(join(tmpdir(), 'rntme-blueprint-'));
    const copied = join(temp, 'product-catalog-project');
    cpSync(fixtureDir, copied, { recursive: true });
    writeFileSync(
      join(copied, 'services', 'catalog', 'service.json'),
      JSON.stringify({ kind: 'not-a-kind' }, null, 2),
    );

    const r = loadBlueprint(copied);
    expect(r.ok).toBe(false);
    if (r.ok) return;

    expect(r.errors[0]).toMatchObject({
      layer: 'load',
      code: ERROR_CODES.BLUEPRINT_SERVICE_JSON_MALFORMED,
      path: 'services/catalog/service.json',
    });
    expect(r.errors[0]!.message).toContain('service "catalog" service.json failed validation');
    expect(r.errors[0]!.cause).toEqual(expect.any(Array));
  });
});
