import { describe, expect, it } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { readServiceGraphSpec } from '../../src/compose/service-graphs.js';
import { ERROR_CODES } from '../../src/types/result.js';

function writeJson(root: string, rel: string, value: unknown): void {
  const path = join(root, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2));
}

function writeText(root: string, rel: string, value: string): void {
  const path = join(root, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value);
}

function validGraph(id: string): unknown {
  return {
    id,
    signature: {
      inputs: {},
      output: { type: 'rowset<ProductRow>', from: 'items' },
    },
    nodes: [],
  };
}

async function expectInvalidServiceGraphs(root: string): Promise<void> {
  const r = await readServiceGraphSpec(root, 'catalog');
  expect(r.ok).toBe(false);
  if (!r.ok) {
    expect(r.errors[0]?.code).toBe(
      ERROR_CODES.BLUEPRINT_SERVICE_GRAPHS_INVALID,
    );
  }
}

describe('readServiceGraphSpec', () => {
  it('loads graphs/shapes.json and graph documents from a service directory', async () => {
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

    const r = await readServiceGraphSpec(root, 'catalog');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(Object.keys(r.value.graphs)).toEqual(['listProducts']);
      expect(r.value.shapes.ProductRow?.fields.productId?.type).toBe(
        'integer',
      );
    }
  });

  it('returns BLUEPRINT_SERVICE_GRAPHS_INVALID when shapes.json is missing', async () => {
    const root = mkdtempSync(join(tmpdir(), 'rntme-blueprint-'));
    writeJson(
      root,
      'services/catalog/graphs/listProducts.json',
      validGraph('listProducts'),
    );

    await expectInvalidServiceGraphs(root);
  });

  it('returns BLUEPRINT_SERVICE_GRAPHS_INVALID for invalid JSON in shapes.json', async () => {
    const root = mkdtempSync(join(tmpdir(), 'rntme-blueprint-'));
    writeText(root, 'services/catalog/graphs/shapes.json', '{');
    writeJson(
      root,
      'services/catalog/graphs/listProducts.json',
      validGraph('listProducts'),
    );

    await expectInvalidServiceGraphs(root);
  });

  it('returns BLUEPRINT_SERVICE_GRAPHS_INVALID for invalid JSON in a graph file', async () => {
    const root = mkdtempSync(join(tmpdir(), 'rntme-blueprint-'));
    writeJson(root, 'services/catalog/graphs/shapes.json', {
      ProductRow: {
        fields: {
          productId: { type: 'integer', nullable: false },
        },
      },
    });
    writeText(root, 'services/catalog/graphs/listProducts.json', '{');

    await expectInvalidServiceGraphs(root);
  });

  it('returns BLUEPRINT_SERVICE_GRAPHS_INVALID for malformed-but-valid shapes JSON', async () => {
    const root = mkdtempSync(join(tmpdir(), 'rntme-blueprint-'));
    writeJson(root, 'services/catalog/graphs/shapes.json', {
      ProductRow: {
        fields: {
          productId: { type: 'integer' },
        },
      },
    });
    writeJson(
      root,
      'services/catalog/graphs/listProducts.json',
      validGraph('listProducts'),
    );

    await expectInvalidServiceGraphs(root);
  });

  it('returns BLUEPRINT_SERVICE_GRAPHS_INVALID for malformed-but-valid graph JSON', async () => {
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
        inputs: {
          limit: { type: 'integer' },
        },
        output: { type: 'rowset<ProductRow>', from: 'items' },
      },
      nodes: [],
    });

    await expectInvalidServiceGraphs(root);
  });

  it('returns BLUEPRINT_SERVICE_GRAPHS_INVALID for an unknown input mode', async () => {
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
        inputs: {
          limit: { type: 'integer', mode: 'sometimes' },
        },
        output: { type: 'rowset<ProductRow>', from: 'items' },
      },
      nodes: [],
    });

    await expectInvalidServiceGraphs(root);
  });

  it('returns BLUEPRINT_SERVICE_GRAPHS_INVALID when filename stem differs from graph id', async () => {
    const root = mkdtempSync(join(tmpdir(), 'rntme-blueprint-'));
    writeJson(root, 'services/catalog/graphs/shapes.json', {
      ProductRow: {
        fields: {
          productId: { type: 'integer', nullable: false },
        },
      },
    });
    writeJson(
      root,
      'services/catalog/graphs/listProducts.json',
      validGraph('listCatalogProducts'),
    );

    await expectInvalidServiceGraphs(root);
  });

  it('ignores shapes.json as a graph and loads graph files in sorted order', async () => {
    const root = mkdtempSync(join(tmpdir(), 'rntme-blueprint-'));
    writeJson(root, 'services/catalog/graphs/shapes.json', {
      ProductRow: {
        fields: {
          productId: { type: 'integer', nullable: false },
        },
      },
    });
    writeJson(
      root,
      'services/catalog/graphs/zListProducts.json',
      validGraph('zListProducts'),
    );
    writeJson(
      root,
      'services/catalog/graphs/aGetProduct.json',
      validGraph('aGetProduct'),
    );

    const r = await readServiceGraphSpec(root, 'catalog');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(Object.keys(r.value.graphs)).toEqual([
        'aGetProduct',
        'zListProducts',
      ]);
    }
  });
});
