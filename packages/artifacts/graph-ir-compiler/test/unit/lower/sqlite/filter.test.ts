import { describe, it, expect } from 'vitest';
import { lowerToSqlite } from '../../../../src/lower/sqlite/lower.js';
import { emitSql } from '../../../../src/lower/sqlite/emit.js';
import type { RelOp } from '../../../../src/types/relational.js';
import type { Expr } from '../../../../src/types/authoring.js';

describe('lower Filter', () => {
  it('emits WHERE with param placeholder', () => {
    const rel: RelOp = {
      op: 'Filter',
      predicate: { gte: ['orderItem.unitPrice', { $param: 'minPrice' }] } as Expr,
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
    const { ast, paramOrder } = lowerToSqlite(rel);
    const sql = emitSql(ast);
    expect(sql).toContain('WHERE ("orderItem"."unit_price" >= ?)');
    expect(paramOrder).toEqual(['minPrice']);
  });
});
