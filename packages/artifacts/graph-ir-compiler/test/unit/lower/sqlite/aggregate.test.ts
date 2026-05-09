import { describe, it, expect } from 'vitest';
import { lowerToSqlite } from '../../../../src/lower/sqlite/lower.js';
import { emitSql } from '../../../../src/lower/sqlite/emit.js';
import type { RelOp } from '../../../../src/types/relational.js';
import { emptyQsm } from '../../../fixtures/validated-commerce.js';

describe('Aggregate lowering', () => {
  it('emits GROUP BY + SUM/COUNT/AVG', () => {
    const rel: RelOp = {
      op: 'Aggregate',
      into: 'Agg',
      group: { categoryId: 'orderItem.productId' },
      measures: {
        revenue: { fn: 'sum', expr: { mul: ['orderItem.unitPrice', 'orderItem.quantity'] } as never },
        lineCount: { fn: 'count' },
        avgItemPrice: { fn: 'avg', expr: 'orderItem.unitPrice' as never },
      },
      child: {
        op: 'Scan',
        table: 'order_items',
        alias: 'orderItem',
        fields: [
          { name: 'unitPrice', column: 'unit_price', type: 'decimal', nullable: false },
          { name: 'quantity', column: 'quantity', type: 'integer', nullable: false },
          { name: 'productId', column: 'product_id', type: 'integer', nullable: false },
        ],
      },
    };
    const { ast } = lowerToSqlite(rel, {
      predicateOptionalParams: new Set(),
      qsm: emptyQsm,
    });
    const sql = emitSql(ast);
    expect(sql).toContain('GROUP BY "orderItem"."product_id"');
    expect(sql).toContain('SUM(("orderItem"."unit_price" * "orderItem"."quantity")) AS "revenue"');
    expect(sql).toContain('COUNT(*) AS "lineCount"');
    expect(sql).toContain('AVG("orderItem"."unit_price") AS "avgItemPrice"');
  });
});
