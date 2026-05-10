import { describe, it, expect } from 'bun:test';
import { validateStructural } from '@rntme/qsm';
import type { ValidatedQsm } from '@rntme/qsm';
import { lowerToSqlite } from '../../../../src/lower/sqlite/lower.js';
import { emitSql } from '../../../../src/lower/sqlite/emit.js';
import type { RelOp } from '../../../../src/types/relational.js';
import type { Expr } from '../../../../src/types/authoring.js';
import { commercePdm as P } from '../../../fixtures/validated-commerce.js';

/**
 * Minimal inline QSM for dot-nav tests.
 *
 * The Order entity in commerce PDM has no stateMachine so it cannot pass
 * cross-ref validation; we use validateStructural + cast per the existing
 * test-style convention for such cases.
 */
function buildMiniQsm(): ValidatedQsm {
  const raw = {
    projections: {
      OrderItemMirror: {
        backing: 'entity-mirror' as const,
        source: { entity: 'OrderItem' },
        keys: ['id'],
        grain: ['id'],
        exposed: ['id', 'orderId', 'productId', 'quantity', 'unitPrice'],
        table: 'order_items',
      },
      OrderMirror: {
        backing: 'entity-mirror' as const,
        source: { entity: 'Order' },
        keys: ['id'],
        grain: ['id'],
        exposed: ['id', 'createdAt'],
        table: 'orders',
      },
    },
    relations: {
      'OrderItemMirror.order': {
        to: 'OrderMirror',
        localKey: 'orderId',
        foreignKey: 'id',
        cardinality: 'one' as const,
      },
    },
  };
  const result = validateStructural(raw);
  if (!result.ok) {
    throw new Error(`buildMiniQsm (structural) failed: ${JSON.stringify(result.errors)}`);
  }
  // Cast to ValidatedQsm: cross-ref validation is skipped because the Order
  // entity has no stateMachine in the commerce PDM fixture. The lowering
  // logic only needs projection.table and relation join metadata, which
  // structural validation has already confirmed are present.
  return result.value as unknown as ValidatedQsm;
}

const miniQsm: ValidatedQsm = buildMiniQsm();

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
    const { ast } = lowerToSqlite(rel, { predicateOptionalParams: new Set(), pdm: P, qsm: miniQsm });
    const sql = emitSql(ast);
    expect(sql).toContain('LEFT JOIN "orders" AS "order"');
    expect(sql).toContain('"orderItem"."order_id" = "order"."id"');
    expect(sql).toContain('"order"."created_at"');
  });
});
