import type { Pdm } from '../../types/pdm.js';
import type { Scope } from './scope.js';
import { resolveField } from './fields.js';
import { ERROR_CODES, err, ok, type GraphIrError, type Result } from '../../types/result.js';

export type ExprType = { type: string; nullable: boolean };

export type ParamMap = Map<string, { type: string; nullable: boolean }>;

const NUMERIC = new Set(['integer', 'long', 'decimal']);
const COMPARABLE = new Set(['integer', 'long', 'decimal', 'string', 'date', 'datetime', 'boolean']);

function widen(a: string, b: string): string | undefined {
  if (a === b) return a;
  if (NUMERIC.has(a) && NUMERIC.has(b)) {
    if (a === 'decimal' || b === 'decimal') return 'decimal';
    if (a === 'long' || b === 'long') return 'long';
    return 'integer';
  }
  if ((a === 'date' && b === 'datetime') || (b === 'date' && a === 'datetime')) return 'datetime';
  return undefined;
}

const BIN_COMPARE = new Set(['eq', 'neq', 'gt', 'gte', 'lt', 'lte']);
const BIN_ARITH = new Set(['add', 'sub', 'mul', 'div']);
const VARIADIC_LOGIC = new Set(['and', 'or']);

export function inferExprType(
  expr: unknown,
  scope: Scope,
  pdm: Pdm,
  params: ParamMap,
): Result<ExprType> {
  if (expr === null) return ok({ type: 'null', nullable: true });
  if (typeof expr === 'boolean') return ok({ type: 'boolean', nullable: false });
  if (typeof expr === 'number') {
    return Number.isInteger(expr)
      ? ok({ type: 'integer', nullable: false })
      : ok({ type: 'decimal', nullable: false });
  }
  if (typeof expr === 'string') {
    const r = resolveField(expr, scope, pdm);
    if (r.ok) return ok({ type: r.value.type, nullable: r.value.nullable });
    return r;
  }
  if (typeof expr === 'object' && expr !== null) {
    if ('$literal' in expr) return ok({ type: 'string', nullable: false });
    if ('$param' in expr) {
      const name = (expr as { $param: string }).$param;
      const p = params.get(name);
      if (!p) {
        return err([
          { layer: 'semantic', code: ERROR_CODES.SEM_PARAM_UNKNOWN, message: `unknown $param "${name}"` },
        ]);
      }
      return ok({ type: p.type, nullable: p.nullable });
    }
    const opEntry = Object.entries(expr as Record<string, unknown>)[0];
    if (!opEntry) return err([{ layer: 'semantic', code: ERROR_CODES.SEM_TYPE_MISMATCH, message: 'empty expr' }]);
    const [op, raw] = opEntry;
    const args = Array.isArray(raw) ? raw : [raw];

    if (BIN_COMPARE.has(op)) {
      const [l, r] = await2(args, scope, pdm, params);
      const errors: GraphIrError[] = [];
      if (!l.ok) errors.push(...l.errors);
      if (!r.ok) errors.push(...r.errors);
      if (errors.length) return err(errors);
      if (l.ok && r.ok) {
        if (!COMPARABLE.has(l.value.type) || !widen(l.value.type, r.value.type)) {
          return err([
            {
              layer: 'semantic',
              code: ERROR_CODES.SEM_TYPE_MISMATCH,
              message: `cannot compare ${l.value.type} and ${r.value.type}`,
            },
          ]);
        }
        return ok({ type: 'boolean', nullable: l.value.nullable || r.value.nullable });
      }
    }
    if (BIN_ARITH.has(op)) {
      const [l, r] = await2(args, scope, pdm, params);
      if (!l.ok) return l;
      if (!r.ok) return r;
      const w = widen(l.value.type, r.value.type);
      if (!w || !NUMERIC.has(w)) {
        return err([
          {
            layer: 'semantic',
            code: ERROR_CODES.SEM_TYPE_MISMATCH,
            message: `cannot apply ${op} to ${l.value.type} and ${r.value.type}`,
          },
        ]);
      }
      return ok({ type: w, nullable: l.value.nullable || r.value.nullable });
    }
    if (VARIADIC_LOGIC.has(op) || op === 'not') {
      const errors: GraphIrError[] = [];
      let nullable = false;
      for (const a of args) {
        const r = inferExprType(a, scope, pdm, params);
        if (!r.ok) errors.push(...r.errors);
        else if (r.value.type !== 'boolean') {
          errors.push({ layer: 'semantic', code: ERROR_CODES.SEM_TYPE_MISMATCH, message: `${op} requires boolean` });
        } else {
          nullable = nullable || r.value.nullable;
        }
      }
      return errors.length ? err(errors) : ok({ type: 'boolean', nullable });
    }
    if (op === 'is_null') {
      if (args.length !== 1) return err([{ layer: 'semantic', code: ERROR_CODES.SEM_TYPE_MISMATCH, message: 'is_null is unary' }]);
      const r = inferExprType(args[0], scope, pdm, params);
      if (!r.ok) return r;
      return ok({ type: 'boolean', nullable: false });
    }
    if (op === 'concat') {
      for (const a of args) {
        const r = inferExprType(a, scope, pdm, params);
        if (!r.ok) return r;
        if (r.value.type !== 'string') {
          return err([{ layer: 'semantic', code: ERROR_CODES.SEM_TYPE_MISMATCH, message: 'concat requires strings' }]);
        }
      }
      return ok({ type: 'string', nullable: false });
    }
    if (op === 'coalesce') {
      let t: string | undefined;
      let nullable = true;
      for (const a of args) {
        const r = inferExprType(a, scope, pdm, params);
        if (!r.ok) return r;
        t = t === undefined ? r.value.type : widen(t, r.value.type);
        if (!t) return err([{ layer: 'semantic', code: ERROR_CODES.SEM_TYPE_MISMATCH, message: 'coalesce operands must widen' }]);
        nullable = r.value.nullable && nullable;
      }
      return ok({ type: t ?? 'null', nullable });
    }
    if (op === 'like') {
      const [l, r] = await2(args, scope, pdm, params);
      if (!l.ok) return l;
      if (!r.ok) return r;
      if (l.value.type !== 'string' || r.value.type !== 'string') {
        return err([{ layer: 'semantic', code: ERROR_CODES.SEM_TYPE_MISMATCH, message: 'like requires two strings' }]);
      }
      return ok({ type: 'boolean', nullable: l.value.nullable || r.value.nullable });
    }
    if (op === 'between') {
      const [e, lo, hi] = args;
      const er = inferExprType(e, scope, pdm, params);
      const lr = inferExprType(lo, scope, pdm, params);
      const hr = inferExprType(hi, scope, pdm, params);
      for (const res of [er, lr, hr]) if (!res.ok) return res;
      if (er.ok && lr.ok && hr.ok) {
        const w1 = widen(er.value.type, lr.value.type);
        const w2 = widen(w1 ?? 'null', hr.value.type);
        if (!w1 || !w2)
          return err([{ layer: 'semantic', code: ERROR_CODES.SEM_TYPE_MISMATCH, message: 'between types must widen' }]);
        return ok({ type: 'boolean', nullable: er.value.nullable || lr.value.nullable || hr.value.nullable });
      }
    }
    return err([
      { layer: 'semantic', code: ERROR_CODES.SEM_TYPE_MISMATCH, message: `unsupported operator "${op}"` },
    ]);
  }
  return err([{ layer: 'semantic', code: ERROR_CODES.SEM_TYPE_MISMATCH, message: `unsupported expr form` }]);
}

function await2(
  args: unknown[],
  scope: Scope,
  pdm: Pdm,
  params: ParamMap,
): [Result<ExprType>, Result<ExprType>] {
  return [inferExprType(args[0], scope, pdm, params), inferExprType(args[1], scope, pdm, params)];
}
