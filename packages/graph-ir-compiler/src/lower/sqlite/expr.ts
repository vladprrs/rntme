import type { Expr } from '../../types/authoring.js';
import type { SqlExpr } from './ast.js';

export type ExprLowerCtx = {
  alias: string;
  columnOf: (path: string) => { table: string; column: string };
  paramOrder: string[];
  predicateOptionalParams?: Set<string>;
};

export function lowerExpr(e: Expr, ctx: ExprLowerCtx): SqlExpr {
  if (e === null) return { kind: 'null' };
  if (typeof e === 'boolean') return { kind: 'bool', value: e };
  if (typeof e === 'number') return { kind: 'num', value: e };
  if (typeof e === 'string') {
    const { table, column } = ctx.columnOf(e);
    return { kind: 'col', table, column };
  }
  if (typeof e === 'object') {
    if ('$literal' in e) return { kind: 'str', value: (e as { $literal: string }).$literal };
    if ('$param' in e) {
      const name = (e as { $param: string }).$param;
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
  throw new Error(`lowerExpr: unsupported ${JSON.stringify(e)}`);
}
