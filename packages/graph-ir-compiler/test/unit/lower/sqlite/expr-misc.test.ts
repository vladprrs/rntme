import { describe, it, expect } from 'vitest';
import { lowerExpr } from '../../../../src/lower/sqlite/expr.js';
import { emitSql } from '../../../../src/lower/sqlite/emit.js';
import type { Expr } from '../../../../src/types/authoring.js';

const ctx = { alias: 't', columnOf: (p: string) => ({ table: 't', column: p.split('.')[1]! }), paramOrder: [] };

function emit(expr: unknown): string {
  return emitSql({
    kind: 'select',
    columns: [{ expr: lowerExpr(expr as Expr, ctx as never), alias: 'x' }],
    from: { table: 't', alias: 't' },
    joins: [],
  });
}

describe('misc EXPR lowering', () => {
  it('between', () => {
    expect(emit({ between: ['t.a', 0, 100] })).toContain('("t"."a" BETWEEN 0 AND 100)');
  });
  it('coalesce', () => {
    expect(emit({ coalesce: ['t.a', 't.b', 0] })).toContain('COALESCE("t"."a", "t"."b", 0)');
  });
  it('concat', () => {
    expect(emit({ concat: [{ $literal: 'hi ' }, 't.name'] })).toContain("('hi ' || \"t\".\"name\")");
  });
  it('like', () => {
    expect(emit({ like: ['t.name', { $literal: 'A%' }] })).toContain("(\"t\".\"name\" LIKE 'A%')");
  });
  it('case', () => {
    expect(
      emit({
        case: { when: [[{ gt: ['t.a', 0] }, { $literal: 'pos' }]], else: { $literal: 'neg' } },
      }),
    ).toContain("(CASE WHEN (\"t\".\"a\" > 0) THEN 'pos' ELSE 'neg' END)");
  });
});
