import { describe, it, expect } from 'bun:test';
import { lowerToSqlite } from '../../../../src/lower/sqlite/lower.js';
import type { RelOp } from '../../../../src/types/relational.js';
import { emptyQsm } from '../../../fixtures/validated-commerce.js';

describe('lowerToSqlite (scan + limit)', () => {
  it('produces a SELECT AST with limit literal', () => {
    const rel: RelOp = {
      op: 'Limit',
      count: 10,
      child: {
        op: 'Scan',
        table: 'order_items',
        alias: 'orderItem',
        fields: [
          { name: 'id', column: 'id', type: 'integer', nullable: false },
          { name: 'unitPrice', column: 'unit_price', type: 'decimal', nullable: false },
        ],
      },
    };
    const { ast, paramOrder } = lowerToSqlite(rel, {
      predicateOptionalParams: new Set(),
      qsm: emptyQsm,
    });
    expect(ast.kind).toBe('select');
    expect(ast.from).toEqual({ table: 'order_items', alias: 'orderItem' });
    expect(ast.limit).toEqual({ kind: 'num', value: 10 });
    expect(ast.columns.map((c) => c.alias)).toEqual(['id', 'unitPrice']);
    expect(paramOrder).toEqual([]);
  });
});
