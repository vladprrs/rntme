import { runtimeError } from '../types/errors.js';
import type { Expr } from '../types/authoring.js';

export type NodeOutputs = Record<string, unknown>;

export function evalOperationExpr(
  expr: Expr,
  params: Record<string, unknown>,
  outputs: NodeOutputs,
): unknown {
  if (expr === null || typeof expr === 'number' || typeof expr === 'boolean') return expr;
  if (typeof expr === 'string') return readPath(outputs, expr);
  if ('$literal' in expr) return expr.$literal;
  if ('$param' in expr) return params[expr.$param] ?? null;
  if ('$ref' in expr) return readPath(outputs, expr.$ref);
  if ('$node' in expr) return outputs[expr.$node] ?? null;
  if ('gte' in expr) {
    const [a, b] = expr.gte ?? [];
    return Number(evalOperationExpr(a!, params, outputs)) >= Number(evalOperationExpr(b!, params, outputs));
  }
  if ('eq' in expr) {
    const [a, b] = expr.eq ?? [];
    return evalOperationExpr(a!, params, outputs) === evalOperationExpr(b!, params, outputs);
  }
  if ('and' in expr) return (expr.and ?? []).every((e) => Boolean(evalOperationExpr(e, params, outputs)));
  if ('or' in expr) return (expr.or ?? []).some((e) => Boolean(evalOperationExpr(e, params, outputs)));
  if ('not' in expr) return !evalOperationExpr((expr.not ?? [])[0]!, params, outputs);
  throw runtimeError('RUNTIME_INTERNAL_ERROR', `unsupported operation expression: ${JSON.stringify(expr)}`);
}

export function evalObjectExpr(
  value: Record<string, Expr> | Expr,
  params: Record<string, unknown>,
  outputs: NodeOutputs,
): unknown {
  if (value !== null && typeof value === 'object' && !Array.isArray(value) && !isExprObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, expr] of Object.entries(value as Record<string, Expr>)) {
      out[key] = evalOperationExpr(expr, params, outputs);
    }
    return out;
  }
  return evalOperationExpr(value as Expr, params, outputs);
}

function isExprObject(value: Record<string, unknown>): boolean {
  return Object.keys(value).some((key) => key.startsWith('$') || ['eq', 'gte', 'and', 'or', 'not'].includes(key));
}

function readPath(root: NodeOutputs, path: string): unknown {
  let cur: unknown = root;
  for (const part of path.split('.')) {
    if (cur === null || cur === undefined) return null;
    if (typeof cur !== 'object' || Array.isArray(cur)) return null;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur ?? null;
}
