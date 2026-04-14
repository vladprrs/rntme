import { describe, it, expect } from 'vitest';
import { lowerFilterWithLifting } from '../../../../src/lower/sqlite/lower.js';
import { emitSql } from '../../../../src/lower/sqlite/emit.js';
import type { RelOp } from '../../../../src/types/relational.js';

describe('predicate_optional lifting', () => {
  it('wraps predicate with null-guard on each predicate_optional param', () => {
    const rel: RelOp = {
      op: 'Filter',
      predicate: { gte: ['orderItem.unitPrice', { $param: 'minPrice' }] } as never,
      child: {
        op: 'Scan',
        table: 'order_items',
        alias: 'orderItem',
        fields: [{ name: 'unitPrice', column: 'unit_price', type: 'decimal', nullable: false }],
      },
    };
    const { ast, paramOrder } = lowerFilterWithLifting(rel, new Set(['minPrice']));
    const sql = emitSql(ast);
    expect(sql).toContain('(? IS NULL) OR ("orderItem"."unit_price" >= ?)');
    expect(paramOrder).toEqual(['minPrice', 'minPrice']);
  });
});
