import { describe, it, expect } from 'bun:test';
import { emitSql } from '../../../../src/lower/sqlite/emit.js';
import type { SqlSelect } from '../../../../src/lower/sqlite/ast.js';

describe('emitSql (scan + limit)', () => {
  it('emits SELECT ... FROM ... LIMIT 10', () => {
    const ast: SqlSelect = {
      kind: 'select',
      from: { table: 'order_items', alias: 'orderItem' },
      joins: [],
      columns: [
        { expr: { kind: 'col', table: 'orderItem', column: 'id' }, alias: 'id' },
        { expr: { kind: 'col', table: 'orderItem', column: 'unit_price' }, alias: 'unitPrice' },
      ],
      limit: { kind: 'num', value: 10 },
    };
    const sql = emitSql(ast);
    expect(sql).toBe(
      'SELECT "orderItem"."id" AS "id", "orderItem"."unit_price" AS "unitPrice" FROM "order_items" AS "orderItem" LIMIT 10',
    );
  });

  it('emits ? for param placeholders', () => {
    const ast: SqlSelect = {
      kind: 'select',
      from: { table: 't', alias: 't' },
      joins: [],
      columns: [{ expr: { kind: 'col', table: 't', column: 'id' }, alias: 'id' }],
      limit: { kind: 'param', ordinal: 0 },
    };
    expect(emitSql(ast)).toContain('LIMIT ?');
  });
});
