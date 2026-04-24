import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { readServiceGraphSpec } from '../../src/compose/service-graphs.js';

function writeJson(root: string, rel: string, value: unknown): void {
  const path = join(root, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2));
}

describe('readServiceGraphSpec', () => {
  it('loads graphs/shapes.json and graph documents from a service directory', () => {
    const root = mkdtempSync(join(tmpdir(), 'rntme-blueprint-'));
    writeJson(root, 'services/catalog/graphs/shapes.json', {
      ProductRow: {
        fields: {
          productId: { type: 'integer', nullable: false },
        },
      },
    });
    writeJson(root, 'services/catalog/graphs/listProducts.json', {
      id: 'listProducts',
      signature: {
        inputs: {},
        output: { type: 'rowset<ProductRow>', from: 'items' },
      },
      nodes: [],
    });

    const r = readServiceGraphSpec(root, 'catalog');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(Object.keys(r.value.graphs)).toEqual(['listProducts']);
      expect(r.value.shapes.ProductRow?.fields.productId?.type).toBe(
        'integer',
      );
    }
  });
});
