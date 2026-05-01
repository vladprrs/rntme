import type { Expr } from '../../types/authoring.js';
import type { SqlExpr } from './ast.js';
import { internalError } from '../../types/errors.js';

export type ExprLowerCtx = {
  alias: string;
  columnOf: (path: string) => { table?: string; column: string };
  paramOrder: string[];
};

export function lowerExpr(e: Expr, ctx: ExprLowerCtx): SqlExpr {
  if (e === null) return { kind: 'null' };
  if (typeof e === 'boolean') return { kind: 'bool', value: e };
  if (typeof e === 'number') return { kind: 'num', value: e };
  if (typeof e === 'string') {
    const ref = ctx.columnOf(e);
    return ref.table !== undefined
      ? { kind: 'col', table: ref.table, column: ref.column }
      : { kind: 'col', column: ref.column };
  }
  if (typeof e === 'object') {
    if ('$literal' in e) return { kind: 'str', value: (e as { $literal: string }).$literal };
    if ('$param' in e) {
      const name = (e as { $param: string }).$param;
      const ordinal = ctx.paramOrder.length;
      ctx.paramOrder.push(name);
      return { kind: 'param', ordinal };
    }
    if ('$pre' in e) {
      const name = `pre.${(e as { $pre: string }).$pre}`;
      const ordinal = ctx.paramOrder.length;
      ctx.paramOrder.push(name);
      return { kind: 'param', ordinal };
    }
    if ('between' in e) {
      const [x, lo, hi] = (e as { between: [Expr, Expr, Expr] }).between;
      return { kind: 'between', expr: lowerExpr(x, ctx), low: lowerExpr(lo, ctx), high: lowerExpr(hi, ctx) };
    }
    if ('case' in e) {
      const c = (e as { case: { when: Array<[Expr, Expr]>; else: Expr } }).case;
      return {
        kind: 'case',
        when: c.when.map(([cond, val]) => [lowerExpr(cond, ctx), lowerExpr(val, ctx)] as [SqlExpr, SqlExpr]),
        else: lowerExpr(c.else, ctx),
      };
    }
    const [op, args] = Object.entries(e as Record<string, unknown>)[0] as [string, Expr[]];
    return { kind: 'op', op, args: args.map((a) => lowerExpr(a, ctx)) };
  }
  throw internalError('lowering', `lowerExpr: unsupported ${JSON.stringify(e)}`);
}
