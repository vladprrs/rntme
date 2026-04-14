import { describe, it, expect } from 'vitest';
import { lowerToSqlite } from '../../../../src/lower/sqlite/lower.js';
import { emitSql } from '../../../../src/lower/sqlite/emit.js';
import type { RelOp } from '../../../../src/types/relational.js';
import type { Expr } from '../../../../src/types/authoring.js';
import { commercePdm as P } from '../../../fixtures/validated-commerce.js';

describe('JOIN synthesis via dot-navigation', () => {
  it('adds JOIN orders when filter uses orderItem.order.createdAt', () => {
    const rel: RelOp = {
      op: 'Filter',
      predicate: {
        gte: ['orderItem.order.createdAt', { $literal: '2026-02-01T00:00:00Z' }],
      } as Expr,
      child: {
        op: 'Scan',
        table: 'order_items',
        alias: 'orderItem',
        entity: 'OrderItem',
        fields: [
          { name: 'id', column: 'id', type: 'integer', nullable: false },
          { name: 'orderId', column: 'order_id', type: 'integer', nullable: false },
        ],
      },
    };
    const { ast } = lowerToSqlite(rel, { predicateOptionalParams: new Set(), pdm: P });
    const sql = emitSql(ast);
    expect(sql).toContain('LEFT JOIN "orders" AS "order"');
    expect(sql).toContain('"orderItem"."order_id" = "order"."id"');
    expect(sql).toContain('"order"."created_at"');
  });
});
