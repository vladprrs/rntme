import { describe, expect, it } from 'bun:test';
import { cpSync, mkdtempSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { loadComposedBlueprint } from '../../src/compose/load-composed-blueprint.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, '..', 'fixtures', 'product-catalog-project');

function copyFixture(): string {
  const temp = mkdtempSync(join(tmpdir(), 'rntme-blueprint-storage-'));
  const copied = join(temp, 'product-catalog-project');
  cpSync(fixtureDir, copied, { recursive: true });
  return copied;
}

describe('blueprint composition with storage.json', () => {
  it('attaches a ValidatedStorageJson to the service member when present', async () => {
    const root = copyFixture();
    writeFileSync(
      join(root, 'services', 'catalog', 'storage.json'),
      JSON.stringify(
        {
          version: '1.0',
          routes: {
            'product-attachments': {
              owner: { aggregate: 'Product', association: 'attachments' },
              maxSize: '10MB',
              allowedTypes: ['image/*'],
              maxCount: 5,
              auth: { requireRole: null },
              lifecycle: { expirePending: '24h', retainCommitted: null },
            },
          },
        },
        null,
        2,
      ),
    );

    const r = await loadComposedBlueprint(root);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const catalog = r.value.services.catalog;
    expect(catalog?.storage).toBeDefined();
    expect(Object.keys(catalog?.storage?.routes ?? {})).toEqual(['product-attachments']);
  });
});
