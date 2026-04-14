import { describe, it, expect } from 'vitest';
import { lowerToSqlite } from '../../../../src/lower/sqlite/lower.js';
import { emitSql } from '../../../../src/lower/sqlite/emit.js';
import type { RelOp } from '../../../../src/types/relational.js';

describe('Project lowering', () => {
  it('replaces columns with the Project cols', () => {
    const rel: RelOp = {
      op: 'Project',
      into: 'Small',
      cols: {
        id: { expr: 'orderItem.id' as never },
        total: { expr: { mul: ['orderItem.unitPrice', 'orderItem.quantity'] } as never },
      },
      child: {
        op: 'Scan',
        table: 'order_items',
        alias: 'orderItem',
        fields: [
          { name: 'id', column: 'id', type: 'integer', nullable: false },
          { name: 'unitPrice', column: 'unit_price', type: 'decimal', nullable: false },
          { name: 'quantity', column: 'quantity', type: 'integer', nullable: false },
        ],
      },
    };
    const { ast } = lowerToSqlite(rel);
    const sql = emitSql(ast);
    expect(sql).toContain('"orderItem"."id" AS "id"');
    expect(sql).toContain('("orderItem"."unit_price" * "orderItem"."quantity") AS "total"');
  });
});
