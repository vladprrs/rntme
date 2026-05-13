import { runtimeError } from '../types/errors.js';
import type { Expr } from '../types/authoring.js';

export type NodeOutputs = Record<string, unknown>;

const OPERATORS = new Set([
  'eq', 'neq', 'lt', 'lte', 'gt', 'gte',
  'and', 'or', 'not',
  'like', 'between', 'is_null',
  'add', 'sub', 'mul', 'div',
  'concat', 'coalesce',
]);

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

  const eval2 = (e: Expr): unknown => evalOperationExpr(e, params, outputs);

  if ('eq' in expr) { const [a, b] = expr.eq ?? []; return eval2(a!) === eval2(b!); }
  if ('neq' in expr) { const [a, b] = expr.neq ?? []; return eval2(a!) !== eval2(b!); }
  if ('lt' in expr) { const [a, b] = expr.lt ?? []; return Number(eval2(a!)) < Number(eval2(b!)); }
  if ('lte' in expr) { const [a, b] = expr.lte ?? []; return Number(eval2(a!)) <= Number(eval2(b!)); }
  if ('gt' in expr) { const [a, b] = expr.gt ?? []; return Number(eval2(a!)) > Number(eval2(b!)); }
  if ('gte' in expr) { const [a, b] = expr.gte ?? []; return Number(eval2(a!)) >= Number(eval2(b!)); }
  if ('and' in expr) return (expr.and ?? []).every((e) => Boolean(eval2(e)));
  if ('or' in expr) return (expr.or ?? []).some((e) => Boolean(eval2(e)));
  if ('not' in expr) return !eval2((expr.not ?? [])[0]!);
  if ('is_null' in expr) return eval2((expr.is_null as Expr[])[0]!) === null;
  if ('like' in expr) {
    const [a, b] = expr.like as [Expr, Expr];
    const value = String(eval2(a) ?? '');
    const pattern = String(eval2(b) ?? '').replace(/^%|%$/g, '');
    return value.includes(pattern);
  }
  if ('between' in expr) {
    const [v, lo, hi] = expr.between as [Expr, Expr, Expr];
    const x = Number(eval2(v));
    return x >= Number(eval2(lo)) && x <= Number(eval2(hi));
  }
  if ('add' in expr) { const [a, b] = expr.add as [Expr, Expr]; return Number(eval2(a)) + Number(eval2(b)); }
  if ('sub' in expr) { const [a, b] = expr.sub as [Expr, Expr]; return Number(eval2(a)) - Number(eval2(b)); }
  if ('mul' in expr) { const [a, b] = expr.mul as [Expr, Expr]; return Number(eval2(a)) * Number(eval2(b)); }
  if ('div' in expr) { const [a, b] = expr.div as [Expr, Expr]; return Number(eval2(a)) / Number(eval2(b)); }
  if ('concat' in expr) return (expr.concat as Expr[]).map((e) => String(eval2(e) ?? '')).join('');
  if ('coalesce' in expr) {
    for (const e of expr.coalesce as Expr[]) {
      const v = eval2(e);
      if (v !== null && v !== undefined) return v;
    }
    return null;
  }
  throw runtimeError('RUNTIME_INTERNAL_ERROR', `unsupported operation expression: ${JSON.stringify(expr)}`);
}

export function evalObjectExpr(
  value: unknown,
  params: Record<string, unknown>,
  outputs: NodeOutputs,
): unknown {
  if (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    !isExprObject(value as Record<string, unknown>)
  ) {
    const out: Record<string, unknown> = {};
    for (const [key, expr] of Object.entries(value as Record<string, unknown>)) {
      out[key] = evalTemplateValue(expr, params, outputs);
    }
    return out;
  }
  return evalTemplateValue(value, params, outputs);
}

function evalTemplateValue(
  value: unknown,
  params: Record<string, unknown>,
  outputs: NodeOutputs,
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => evalTemplateValue(item, params, outputs));
  }
  if (
    value !== null &&
    typeof value === 'object' &&
    !isExprObject(value as Record<string, unknown>)
  ) {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      out[key] = evalTemplateValue(child, params, outputs);
    }
    return out;
  }
  return evalOperationExpr(value as Expr, params, outputs);
}

function isExprObject(value: Record<string, unknown>): boolean {
  return Object.keys(value).some((key) => key.startsWith('$') || OPERATORS.has(key));
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
