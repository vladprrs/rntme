import { describe, it, expect } from 'bun:test';
import { lowerExpr } from '../../../../src/lower/sqlite/expr.js';
import type { Expr } from '../../../../src/types/authoring.js';
import type { SqlExpr } from '../../../../src/lower/sqlite/ast.js';

const ctx = {
  alias: 't',
  columnOf: (p: string) => ({ table: 't', column: p.split('.')[1]! }),
  paramOrder: [],
};

function stringify(e: SqlExpr): string {
  if (e.kind === 'op' && (e.op === 'and' || e.op === 'or')) {
    return `(${e.args.map(stringify).join(` ${e.op.toUpperCase()} `)})`;
  }
  if (e.kind === 'op' && e.op === 'not') return `(NOT ${stringify(e.args[0]!)})`;
  if (e.kind === 'op' && e.op === 'is_null') return `(${stringify(e.args[0]!)} IS NULL)`;
  if (e.kind === 'col') return `"${e.table}"."${e.column}"`;
  return JSON.stringify(e);
}

describe('logical lowering', () => {
  it('and/or', () => {
    const e = lowerExpr({ and: ['t.a', { or: ['t.b', 't.c'] }] } as Expr, ctx as never);
    expect(stringify(e)).toBe('("t"."a" AND ("t"."b" OR "t"."c"))');
  });
  it('not', () => {
    const e = lowerExpr({ not: ['t.a'] } as unknown as Expr, ctx as never);
    expect(stringify(e)).toBe('(NOT "t"."a")');
  });
  it('is_null', () => {
    const e = lowerExpr({ is_null: ['t.a'] } as unknown as Expr, ctx as never);
    expect(stringify(e)).toBe('("t"."a" IS NULL)');
  });
});
