import type { Entity, Relation, ValidatedPdm } from '@rntme/pdm';
import type { RelOp, RelScan } from '../../types/relational.js';
import type { SqlSelect, SqlExpr } from './ast.js';
import { chainToSqlJoins, expandChain } from './joins.js';
import { lowerExpr, type ExprLowerCtx } from './expr.js';
import type { Expr } from '../../types/authoring.js';

export type LowerResult = { ast: SqlSelect; paramOrder: string[] };

export type LowerContext = {
  predicateOptionalParams: Set<string>;
  pdm?: ValidatedPdm;
};

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
      const columnOf = makeColumnOf(scanMeta, child, context, relOutputColumns(rel.child));
      const predicateSql = lowerExpr(rel.predicate as Expr, {
        alias: scanMeta.alias,
        columnOf,
        paramOrder,
      });
      const guarded = wrapPredicateOptional(
        predicateSql,
        rel.predicate,
        paramOrder,
        context.predicateOptionalParams,
      );
      if (rel.child.op === 'Aggregate') {
        child.having = child.having
          ? { kind: 'op', op: 'and', args: [child.having, guarded] }
          : guarded;
      } else {
        child.where = child.where ? { kind: 'op', op: 'and', args: [child.where, guarded] } : guarded;
      }
      return child;
    }
    case 'Project': {
      const child = toSelect(rel.child, paramOrder, context);
      const scanMeta = findScanMeta(rel);
      const columnOf = makeColumnOf(scanMeta, child, context, relOutputColumns(rel.child));
      const ctx = {
        alias: scanMeta.alias,
        columnOf,
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
      const columnOf = makeColumnOf(scanMeta, child, context, relOutputColumns(rel.child));
      const ctx = {
        alias: scanMeta.alias,
        columnOf,
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
      const columnOf = makeColumnOf(scan, child, context, relOutputColumns(rel.child));
      const ctx = {
        alias: scan.alias,
        columnOf,
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

type ScanMeta = { alias: string; fields: RelScan['fields']; entity?: string };

function findScanMeta(rel: RelOp): ScanMeta {
  let cur: RelOp = rel;
  while (cur.op !== 'Scan') {
    if (cur.op === 'Join') cur = cur.left;
    else if ('child' in cur) cur = cur.child;
    else throw new Error('no scan found');
  }
  const scan = cur;
  const base: ScanMeta = { alias: scan.alias, fields: scan.fields };
  return scan.entity !== undefined ? { ...base, entity: scan.entity } : base;
}

function relOutputColumns(rel: RelOp): Set<string> {
  switch (rel.op) {
    case 'Scan':
      return new Set(rel.fields.map((f) => f.name));
    case 'Project':
      return new Set(Object.keys(rel.cols));
    case 'Aggregate':
      return new Set([...Object.keys(rel.group), ...Object.keys(rel.measures)]);
    case 'Filter':
    case 'Sort':
    case 'Limit':
      return relOutputColumns(rel.child);
    case 'Join':
      throw new Error('lower: relOutputColumns not implemented for Join');
  }
}

function makeColumnOf(
  scan: ScanMeta,
  child: SqlSelect,
  context: LowerContext,
  outputCols: Set<string>,
): (path: string) => { table?: string; column: string } {
  const addedAliases = new Set<string>([scan.alias]);
  return (path: string) => {
    if (!path.includes('.')) {
      if (outputCols.has(path)) return { column: path };
    }
    const parts = path.split('.');
    if (parts.length === 2) {
      const [head, name] = parts as [string, string];
      if (head === scan.alias) {
        const f = scan.fields.find((x) => x.name === name);
        if (f) return { table: head, column: f.column };
      }
    }
    if (parts.length > 2 && context.pdm && scan.entity) {
      if (parts[0] !== scan.alias) {
        throw new Error(`lower: path "${path}" root alias does not match scan`);
      }
      const prefix = parts.slice(0, -1);
      const joinChain = expandChain(scan.alias, scan.entity, prefix, context.pdm);
      const joins = chainToSqlJoins(joinChain, context.pdm);
      for (const j of joins) {
        if (!addedAliases.has(j.alias)) {
          child.joins.push(j);
          addedAliases.add(j.alias);
        }
      }
      const leafAlias = parts[parts.length - 2]!;
      const leafField = parts[parts.length - 1]!;
      const rootEnt = context.pdm.entities[scan.entity];
      if (!rootEnt) throw new Error(`lower: unknown entity ${scan.entity}`);
      let curEnt: Entity = rootEnt;
      for (let i = 1; i < parts.length - 1; i++) {
        const stepName = parts[i]!;
        const stepRel: Relation | undefined = curEnt.relations?.[stepName];
        if (!stepRel) throw new Error(`lower: missing relation ${stepName}`);
        const nextEnt: Entity | undefined = context.pdm.entities[stepRel.to];
        if (!nextEnt) throw new Error(`lower: missing entity ${stepRel.to}`);
        curEnt = nextEnt;
      }
      const col = curEnt.fields[leafField]?.column;
      if (!col) throw new Error(`lower: missing field ${leafField}`);
      return { table: leafAlias, column: col };
    }
    throw new Error(`lower: cannot resolve field path "${path}"`);
  };
}

function paramPlaceholder(name: string, paramOrder: string[]): SqlExpr {
  paramOrder.push(name);
  return { kind: 'param', ordinal: paramOrder.length - 1 };
}
