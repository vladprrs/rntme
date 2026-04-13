import type { RelOp, RelScan } from '../../types/relational.js';
import type { SqlSelect, SqlExpr } from './ast.js';
import { lowerExpr, type ExprLowerCtx } from './expr.js';
import type { Expr } from '../../types/authoring.js';

export type LowerResult = { ast: SqlSelect; paramOrder: string[] };

export type LowerContext = { predicateOptionalParams: Set<string> };

export function lowerToSqlite(
  rel: RelOp,
  context: LowerContext = { predicateOptionalParams: new Set() },
): LowerResult {
  const paramOrder: string[] = [];
  const ast = toSelect(rel, paramOrder, context);
  return { ast, paramOrder };
}

export function lowerFilterWithLifting(rel: RelOp, predicateOptionalParams: Set<string>): LowerResult {
  return lowerToSqlite(rel, { predicateOptionalParams });
}

function measureToAggSql(
  m: { fn: string; expr?: Expr },
  ctx: ExprLowerCtx,
): SqlExpr {
  if (m.fn === 'count') {
    return { kind: 'agg', fn: 'count', args: [{ kind: 'op', op: '*', args: [] }] };
  }
  if (m.fn === 'count_distinct') {
    return {
      kind: 'agg',
      fn: 'count',
      distinct: true,
      args: [lowerExpr(m.expr as Expr, ctx)],
    };
  }
  if (m.fn === 'group_array') {
    return { kind: 'func', name: 'json_group_array', args: [lowerExpr(m.expr as Expr, ctx)] };
  }
  return { kind: 'agg', fn: m.fn, args: [lowerExpr(m.expr as Expr, ctx)] };
}

function scanToSelect(s: RelScan): SqlSelect {
  return {
    kind: 'select',
    from: { table: s.table, alias: s.alias },
    joins: [],
    columns: s.fields.map((f) => ({
      expr: { kind: 'col', table: s.alias, column: f.column },
      alias: f.name,
    })),
  };
}

function toSelect(rel: RelOp, paramOrder: string[], context: LowerContext): SqlSelect {
  switch (rel.op) {
    case 'Scan':
      return scanToSelect(rel);
    case 'Limit': {
      const child = toSelect(rel.child, paramOrder, context);
      child.limit =
        typeof rel.count === 'number'
          ? { kind: 'num', value: rel.count }
          : paramPlaceholder(rel.count.$param, paramOrder);
      return child;
    }
    case 'Filter': {
      const child = toSelect(rel.child, paramOrder, context);
      const scanMeta = findScanMeta(rel);
      const predicateSql = lowerExpr(rel.predicate as Expr, {
        alias: scanMeta.alias,
        columnOf: (path) => columnOfFromScan(path, scanMeta),
        paramOrder,
      });
      const guarded = wrapPredicateOptional(
        predicateSql,
        rel.predicate,
        paramOrder,
        context.predicateOptionalParams,
      );
      child.where = child.where ? { kind: 'op', op: 'and', args: [child.where, guarded] } : guarded;
      return child;
    }
    case 'Project': {
      const child = toSelect(rel.child, paramOrder, context);
      const scanMeta = findScanMeta(rel);
      const ctx = {
        alias: scanMeta.alias,
        columnOf: (path: string) => columnOfFromScan(path, scanMeta),
        paramOrder,
      };
      child.columns = Object.entries(rel.cols).map(([name, c]) => ({
        expr: lowerExpr(c.expr as Expr, ctx),
        alias: name,
      }));
      return child;
    }
    case 'Aggregate': {
      const child = toSelect(rel.child, paramOrder, context);
      const scanMeta = findScanMeta(rel);
      const ctx = {
        alias: scanMeta.alias,
        columnOf: (path: string) => columnOfFromScan(path, scanMeta),
        paramOrder,
      };
      const groupKeys: SqlExpr[] = Object.entries(rel.group).map(([, path]) =>
        lowerExpr(path as Expr, ctx),
      );
      const cols: Array<{ expr: SqlExpr; alias: string }> = [
        ...Object.entries(rel.group).map(([name, path]) => ({
          expr: lowerExpr(path as Expr, ctx),
          alias: name,
        })),
        ...Object.entries(rel.measures).map(([name, m]) => ({
          expr: measureToAggSql(m, ctx),
          alias: name,
        })),
      ];
      child.columns = cols;
      child.groupBy = groupKeys;
      return child;
    }
    case 'Sort': {
      const child = toSelect(rel.child, paramOrder, context);
      const scan = findScanMeta(rel);
      const ctx = {
        alias: scan.alias,
        columnOf: (p: string) => columnOfFromScan(p, scan),
        paramOrder,
      };
      child.orderBy = rel.keys.map((k) => ({
        expr: lowerExpr(k.field as Expr, ctx),
        dir: k.dir,
        nulls: k.nulls,
      }));
      return child;
    }
    default:
      throw new Error(`lowerToSqlite: operator ${rel.op} not yet supported`);
  }
}

function wrapPredicateOptional(
  predicateSql: SqlExpr,
  predicate: unknown,
  paramOrder: string[],
  predicateOptionalParams: Set<string>,
): SqlExpr {
  const used = uniqueInOrder(
    collectParamRefs(predicate).filter((n) => predicateOptionalParams.has(n)),
  );
  return used.reduce<SqlExpr>((acc, name) => {
    const ordinal = paramOrder.length;
    paramOrder.push(name);
    return {
      kind: 'op',
      op: 'or',
      args: [{ kind: 'op', op: 'is_null', args: [{ kind: 'param', ordinal }] }, acc],
    };
  }, predicateSql);
}

function collectParamRefs(expr: unknown): string[] {
  const found: string[] = [];
  const walk = (e: unknown): void => {
    if (e === null || typeof e !== 'object') return;
    if (Array.isArray(e)) {
      e.forEach(walk);
      return;
    }
    const obj = e as Record<string, unknown>;
    if ('$param' in obj && typeof obj.$param === 'string') found.push(obj.$param);
    for (const v of Object.values(obj)) walk(v);
  };
  walk(expr);
  return found;
}

function uniqueInOrder(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of names) {
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

type ScanMeta = { alias: string; fields: RelScan['fields'] };

function findScanMeta(rel: RelOp): ScanMeta {
  let cur: RelOp = rel;
  while (cur.op !== 'Scan') {
    if (cur.op === 'Join') cur = cur.left;
    else if ('child' in cur) cur = cur.child;
    else throw new Error('no scan found');
  }
  return { alias: cur.alias, fields: cur.fields };
}

function columnOfFromScan(path: string, meta: ScanMeta): { table: string; column: string } {
  const [head, rest] = path.split('.', 2);
  if (head === meta.alias && rest) {
    const f = meta.fields.find((x) => x.name === rest);
    if (f) return { table: meta.alias, column: f.column };
  }
  throw new Error(`lower: cannot resolve field path "${path}"`);
}

function paramPlaceholder(name: string, paramOrder: string[]): SqlExpr {
  paramOrder.push(name);
  return { kind: 'param', ordinal: paramOrder.length - 1 };
}
