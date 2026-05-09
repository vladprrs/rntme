import { describe, it, expect } from 'vitest';
import { lowerToSqlite } from '../../../../src/lower/sqlite/lower.js';
import { emitSql } from '../../../../src/lower/sqlite/emit.js';
import type { RelOp } from '../../../../src/types/relational.js';
import { emptyQsm } from '../../../fixtures/validated-commerce.js';

describe('Sort lowering', () => {
  it('emits ORDER BY with dir/nulls', () => {
    const rel: RelOp = {
      op: 'Sort',
      keys: [
        { field: 'orderItem.unitPrice', dir: 'desc', nulls: 'last' },
        { field: 'orderItem.id', dir: 'asc', nulls: 'first' },
      ],
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
    const sql = emitSql(
      lowerToSqlite(rel, { predicateOptionalParams: new Set(), qsm: emptyQsm }).ast,
    );
    expect(sql).toContain(
      'ORDER BY "orderItem"."unit_price" DESC NULLS LAST, "orderItem"."id" ASC NULLS FIRST',
    );
  });
});
