import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { compile, execute } from '../../src/index.js';
import { commercePdm, commerceQsm } from '../fixtures/validated-commerce.js';

const querySpec = {
  version: '1.0-rc7' as const,
  pdmRef: 'p',
  qsmRef: 'q',
  shapes: {},
  graphs: {
    listProductsForUser: {
      id: 'listProductsForUser',
      signature: {
        inputs: {},
        output: { type: 'rowset<Product>', from: 'owned' },
      },
      nodes: [
        { id: 'products', type: 'findMany' as const, config: { source: { entity: 'Product' } } },
        {
          id: 'owned',
          type: 'filter' as const,
          config: {
            input: 'products',
            expr: { eq: ['product.name', { $pre: 'session.user_id' }] },
          },
        },
      ],
    },
  },
};

describe('$pre directive', () => {
  it('lowers $pre references in query filters and resolves them at execution time', () => {
    const compiled = compile(querySpec, commercePdm, commerceQsm);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;

    expect(compiled.value.paramOrder).toEqual(['pre.session.user_id']);

    const db = new Database(':memory:');
    db.exec('CREATE TABLE products (id INTEGER PRIMARY KEY, category_id INTEGER, name TEXT, status TEXT)');
    db.prepare('INSERT INTO products (id, category_id, name, status) VALUES (?, ?, ?, ?)').run(1, 1, 'auth0|u1', 'active');
    db.prepare('INSERT INTO products (id, category_id, name, status) VALUES (?, ?, ?, ?)').run(2, 1, 'auth0|u2', 'active');

    const rows = execute(
      compiled.value,
      { pre: { session: { user_id: 'auth0|u1' } } },
      db,
    ) as Array<{ id: number; name: string }>;

    expect(rows).toEqual([{ id: 1, categoryId: 1, name: 'auth0|u1', status: 'active' }]);
    db.close();
  });

  it('rejects $pre in findMany source with a specific graph error', () => {
    const bad = structuredClone(querySpec);
    bad.graphs.listProductsForUser.nodes[0]!.config.source = { entity: { $pre: 'session.entity' } } as never;

    const compiled = compile(bad, commercePdm, commerceQsm);

    expect(compiled.ok).toBe(false);
    if (!compiled.ok) {
      expect(compiled.errors.map((e) => e.code)).toContain('GRAPH_IR_PRE_REF_NOT_ALLOWED_IN_SOURCE');
    }
  });
});
