import { describe, it, expect } from 'bun:test';
import { lowerToSqlite } from '../../../../src/lower/sqlite/lower.js';
import { emitSql } from '../../../../src/lower/sqlite/emit.js';
import type { RelOp } from '../../../../src/types/relational.js';
import { emptyQsm } from '../../../fixtures/validated-commerce.js';

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
    const { ast, paramOrder } = lowerToSqlite(rel, {
      predicateOptionalParams: new Set(['minPrice']),
      qsm: emptyQsm,
    });
    const sql = emitSql(ast);
    expect(sql).toContain('("orderItem"."unit_price" >= ?) OR (? IS NULL)');
    expect(paramOrder).toEqual(['minPrice', 'minPrice']);
  });

  it('aligns param positions when required and predicate_optional params are mixed', () => {
    const rel: RelOp = {
      op: 'Filter',
      predicate: {
        and: [
          { eq: ['orderItem.status', { $param: 'status' }] },
          { gte: ['orderItem.unitPrice', { $param: 'minPrice' }] },
        ],
      } as never,
      child: {
        op: 'Scan',
        table: 'order_items',
        alias: 'orderItem',
        fields: [
          { name: 'status', column: 'status', type: 'string', nullable: false },
          { name: 'unitPrice', column: 'unit_price', type: 'decimal', nullable: false },
        ],
      },
    };
    const { ast, paramOrder } = lowerToSqlite(rel, {
      predicateOptionalParams: new Set(['minPrice']),
      qsm: emptyQsm,
    });
    const sql = emitSql(ast);
    expect(paramOrder).toEqual(['status', 'minPrice', 'minPrice']);
    expect(sql).toContain(
      '(("orderItem"."status" = ?) AND ("orderItem"."unit_price" >= ?)) OR (? IS NULL)',
    );
  });
});
