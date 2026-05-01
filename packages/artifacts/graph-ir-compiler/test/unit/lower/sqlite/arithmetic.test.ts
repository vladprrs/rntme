import { describe, it, expect } from 'vitest';
import { lowerExpr } from '../../../../src/lower/sqlite/expr.js';
import { emitSql } from '../../../../src/lower/sqlite/emit.js';
import type { Expr } from '../../../../src/types/authoring.js';

const ctx = {
  alias: 't',
  columnOf: (p: string) => ({ table: 't', column: p.split('.')[1]! }),
  paramOrder: [],
};

function wrap(expr: unknown): string {
  const sql = emitSql({
    kind: 'select',
    columns: [{ expr: lowerExpr(expr as Expr, ctx as never), alias: 'x' }],
    from: { table: 't', alias: 't' },
    joins: [],
  });
  return sql;
}

describe('arithmetic lowering', () => {
  it('lowers mul', () => expect(wrap({ mul: ['t.a', 't.b'] })).toContain('("t"."a" * "t"."b")'));
  it('lowers add/sub/div mix', () => {
    expect(wrap({ add: [{ sub: ['t.a', 't.b'] }, { div: ['t.c', 2] }] })).toContain(
      '(("t"."a" - "t"."b") + ("t"."c" / 2))',
    );
  });
});
