import type Database from 'better-sqlite3';
import { createPdmResolver, type ValidatedPdm } from '@rntme/pdm';
import { createQsmResolver, type ValidatedQsm } from '@rntme/qsm';
import { runtimeError } from '../types/errors.js';
import type {
  CanonicalFilter,
  CanonicalFindMany,
  CanonicalFindOne,
  CanonicalLimit,
  CanonicalMap,
  CanonicalReduce,
  CanonicalSort,
} from '../types/canonical.js';
import type { Expr } from '../types/authoring.js';

type Row = Record<string, unknown>;
type RowsetMeta = {
  alias: string;
  projectionName: string | null;
  entityName: string | null;
};

export type RowsetMetas = Record<string, RowsetMeta>;

type ReadEvalContext = {
  db: Database.Database;
  pdm: ValidatedPdm;
  qsm: ValidatedQsm;
  params: Record<string, unknown>;
  predicateOptionalParams: ReadonlySet<string>;
  relationCache: Map<string, Row | null>;
};

export function executeFindMany(
  node: CanonicalFindMany,
  ctx: ReadEvalContext,
): { rows: Row[]; meta: RowsetMeta } {
  return readSourceRows(node.source, node.alias, ctx);
}

export function executeFindOne(
  node: CanonicalFindOne,
  ctx: ReadEvalContext,
): Row | null {
  const { rows, meta } = readSourceRows(node.source, node.alias, ctx);
  const matched = rows.filter((row) => Boolean(evalReadExpr(node.where, row, meta, ctx)));
  if (matched.length > 1) {
    throw runtimeError('RUNTIME_INTERNAL_ERROR', `findOne "${node.id}" matched ${matched.length} rows`);
  }
  return matched[0] ?? null;
}

export function executeFilter(
  node: CanonicalFilter,
  rows: Row[],
  meta: RowsetMeta,
  ctx: ReadEvalContext,
): Row[] {
  if (node.expr === undefined) return rows;
  return rows.filter((row) => Boolean(evalReadExpr(node.expr, row, meta, ctx)));
}

export function executeSort(node: CanonicalSort, rows: Row[], meta: RowsetMeta, ctx: ReadEvalContext): Row[] {
  return [...rows].sort((a, b) => {
    for (const key of node.by) {
      const av = evalReadExpr(key.field as Expr, a, meta, ctx);
      const bv = evalReadExpr(key.field as Expr, b, meta, ctx);
      const cmp = compareValues(av, bv, key.nulls);
      if (cmp !== 0) return key.dir === 'desc' ? -cmp : cmp;
    }
    return 0;
  });
}

export function executeLimit(node: CanonicalLimit, rows: Row[], params: Record<string, unknown>): Row[] {
  const count = typeof node.count === 'number' ? node.count : Number(params[node.count.$param] ?? 0);
  return rows.slice(0, Math.max(0, count));
}

export function executeMap(node: CanonicalMap, rows: Row[], meta: RowsetMeta, ctx: ReadEvalContext): Row[] {
  return rows.map((row) => {
    const out: Row = {};
    for (const [field, expr] of Object.entries(node.fields)) {
      out[field] = evalReadExpr(expr as Expr, row, meta, ctx);
    }
    return out;
  });
}

export function executeReduce(node: CanonicalReduce, rows: Row[], meta: RowsetMeta, ctx: ReadEvalContext): Row[] {
  const groups = new Map<string, { groupValues: Row; rows: Row[] }>();
  for (const row of rows) {
    const groupValues: Row = {};
    for (const [name, expr] of Object.entries(node.group)) {
      groupValues[name] = evalReadExpr(expr as Expr, row, meta, ctx);
    }
    const key = JSON.stringify(groupValues);
    const existing = groups.get(key);
    if (existing) existing.rows.push(row);
    else groups.set(key, { groupValues, rows: [row] });
  }

  if (groups.size === 0 && Object.keys(node.group).length === 0) {
    groups.set('{}', { groupValues: {}, rows: [] });
  }

  return Array.from(groups.values(), ({ groupValues, rows: groupRows }) => {
    const out: Row = { ...groupValues };
    for (const [name, measure] of Object.entries(node.measures)) {
      const values = groupRows.map((row) =>
        measure.expr === undefined ? null : evalReadExpr(measure.expr as Expr, row, meta, ctx),
      );
      switch (measure.fn) {
        case 'count':
          out[name] = groupRows.length;
          break;
        case 'sum':
          out[name] = values.reduce<number>((acc, value) => acc + Number(value ?? 0), 0);
          break;
        case 'avg':
          out[name] = values.length === 0
            ? null
            : values.reduce<number>((acc, value) => acc + Number(value ?? 0), 0) / values.length;
          break;
        case 'min':
          out[name] = values.reduce<unknown>((acc, value) => acc === null || compareValues(value, acc, 'last') < 0 ? value : acc, null);
          break;
        case 'max':
          out[name] = values.reduce<unknown>((acc, value) => acc === null || compareValues(value, acc, 'last') > 0 ? value : acc, null);
          break;
        case 'count_distinct':
          out[name] = new Set(values.map((value) => JSON.stringify(value))).size;
          break;
        default:
          throw runtimeError('RUNTIME_INTERNAL_ERROR', `reduce measure "${measure.fn}" is not supported`);
      }
    }
    return out;
  });
}

function readSourceRows(
  source: CanonicalFindMany['source'],
  alias: string,
  ctx: ReadEvalContext,
): { rows: Row[]; meta: RowsetMeta } {
  const scan = resolveScan(source, ctx.pdm, ctx.qsm);
  const columns = scan.fields.map((field) => `${q(field.column)} AS ${q(field.name)}`).join(', ');
  const rows = ctx.db.prepare(`SELECT ${columns} FROM ${q(scan.table)}`).all() as Row[];
  return { rows, meta: { alias, projectionName: scan.projectionName, entityName: scan.entityName } };
}

function resolveScan(
  source: CanonicalFindMany['source'],
  pdm: ValidatedPdm,
  qsm: ValidatedQsm,
): { table: string; projectionName: string | null; entityName: string | null; fields: ReadonlyArray<{ name: string; column: string }> } {
  const pdmResolver = createPdmResolver(pdm);
  const qsmResolver = createQsmResolver(qsm);

  if ('entity' in source) {
    const entity = pdmResolver.resolveEntity(source.entity);
    if (entity === null) {
      throw runtimeError('RUNTIME_INTERNAL_ERROR', `entity "${source.entity}" not found`);
    }
    const mirror = qsmResolver.findEntityMirror(source.entity);
    return {
      table: mirror?.table ?? entity.table,
      projectionName: mirror?.name ?? null,
      entityName: entity.name,
      fields: entity.fields,
    };
  }

  if ('projection' in source) {
    const projection = qsmResolver.resolveProjection(source.projection);
    if (projection === null) {
      throw runtimeError('RUNTIME_INTERNAL_ERROR', `projection "${source.projection}" not found`);
    }
    if (!('entity' in projection.source)) {
      throw runtimeError('RUNTIME_INTERNAL_ERROR', `projection "${source.projection}" is not an entity mirror`);
    }
    const entity = pdmResolver.resolveEntity(projection.source.entity);
    if (entity === null) {
      throw runtimeError('RUNTIME_INTERNAL_ERROR', `entity "${projection.source.entity}" not found`);
    }
    return {
      table: projection.table,
      projectionName: projection.name,
      entityName: entity.name,
      fields: entity.fields.filter((field) => projection.exposed.includes(field.name)),
    };
  }

  throw runtimeError('RUNTIME_INTERNAL_ERROR', 'eventType read sources are not supported by operation execution');
}

function evalReadExpr(expr: Expr, row: Row, meta: RowsetMeta, ctx: ReadEvalContext): unknown {
  if (expr === null || typeof expr === 'number' || typeof expr === 'boolean') return expr;
  if (typeof expr === 'string') return readFieldPath(expr, row, meta, ctx);
  if ('$literal' in expr) return expr.$literal;
  if ('$param' in expr) return ctx.params[expr.$param] ?? null;
  if ('$ref' in expr) return readFieldPath(expr.$ref, row, meta, ctx);
  if ('$node' in expr || '$pre' in expr) return null;

  if (hasSkippedPredicateOptional(expr, ctx)) return true;

  if ('eq' in expr) return compareBinary(expr.eq, row, meta, ctx, (a, b) => a === b);
  if ('neq' in expr) return compareBinary(expr.neq, row, meta, ctx, (a, b) => a !== b);
  if ('lt' in expr) return compareBinary(expr.lt, row, meta, ctx, (a, b) => compareValues(a, b, 'last') < 0);
  if ('lte' in expr) return compareBinary(expr.lte, row, meta, ctx, (a, b) => compareValues(a, b, 'last') <= 0);
  if ('gt' in expr) return compareBinary(expr.gt, row, meta, ctx, (a, b) => compareValues(a, b, 'last') > 0);
  if ('gte' in expr) return compareBinary(expr.gte, row, meta, ctx, (a, b) => compareValues(a, b, 'last') >= 0);
  if ('like' in expr) {
    const [a, b] = expr.like as [Expr, Expr];
    const value = String(evalReadExpr(a, row, meta, ctx) ?? '');
    const pattern = String(evalReadExpr(b, row, meta, ctx) ?? '').replace(/^%|%$/g, '');
    return value.includes(pattern);
  }
  if ('between' in expr) {
    const [valueExpr, minExpr, maxExpr] = expr.between as [Expr, Expr, Expr];
    const value = evalReadExpr(valueExpr, row, meta, ctx);
    return compareValues(value, evalReadExpr(minExpr, row, meta, ctx), 'last') >= 0
      && compareValues(value, evalReadExpr(maxExpr, row, meta, ctx), 'last') <= 0;
  }
  if ('and' in expr) return (expr.and as Expr[]).every((part) => Boolean(evalReadExpr(part, row, meta, ctx)));
  if ('or' in expr) return (expr.or as Expr[]).some((part) => Boolean(evalReadExpr(part, row, meta, ctx)));
  if ('not' in expr) return !evalReadExpr((expr.not as Expr[])[0]!, row, meta, ctx);
  return null;
}

function compareBinary(
  operands: unknown,
  row: Row,
  meta: RowsetMeta,
  ctx: ReadEvalContext,
  predicate: (a: unknown, b: unknown) => boolean,
): boolean {
  const [a, b] = operands as [Expr, Expr];
  return predicate(evalReadExpr(a, row, meta, ctx), evalReadExpr(b, row, meta, ctx));
}

function hasSkippedPredicateOptional(expr: Expr, ctx: ReadEvalContext): boolean {
  const refs: string[] = [];
  const walk = (value: unknown): void => {
    if (value === null || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    const obj = value as Record<string, unknown>;
    if (typeof obj.$param === 'string') refs.push(obj.$param);
    Object.values(obj).forEach(walk);
  };
  walk(expr);
  return refs.some((name) => ctx.predicateOptionalParams.has(name) && (ctx.params[name] ?? null) === null);
}

function readFieldPath(path: string, row: Row, meta: RowsetMeta, ctx: ReadEvalContext): unknown {
  const parts = path.split('.');
  if (parts[0] === meta.alias) parts.shift();
  if (parts.length === 0) return row;
  if (parts.length === 1) return row[parts[0]!];

  const [relationName, ...rest] = parts;
  if (meta.projectionName === null || relationName === undefined) return null;
  const qsmResolver = createQsmResolver(ctx.qsm);
  const relation = qsmResolver.resolveRelation(meta.projectionName, relationName);
  if (relation === null) return null;
  const target = qsmResolver.resolveProjection(relation.to);
  if (target === null || !('entity' in target.source)) return null;

  const keyValue = row[relation.localKey];
  const cacheKey = `${target.name}:${relation.foreignKey}:${String(keyValue)}`;
  let targetRow = ctx.relationCache.get(cacheKey);
  if (targetRow === undefined) {
    targetRow = readRelatedRow(target.name, relation.foreignKey, keyValue, ctx);
    ctx.relationCache.set(cacheKey, targetRow);
  }
  if (targetRow === null) return null;
  return targetRow[rest.join('.')];
}

function readRelatedRow(
  projectionName: string,
  foreignKey: string,
  value: unknown,
  ctx: ReadEvalContext,
): Row | null {
  const qsmResolver = createQsmResolver(ctx.qsm);
  const projection = qsmResolver.resolveProjection(projectionName);
  if (projection === null || !('entity' in projection.source)) return null;
  const entity = createPdmResolver(ctx.pdm).resolveEntity(projection.source.entity);
  if (entity === null) return null;
  const foreignField = entity.fields.find((field) => field.name === foreignKey);
  if (foreignField === undefined) return null;
  const columns = entity.fields
    .filter((field) => projection.exposed.includes(field.name))
    .map((field) => `${q(field.column)} AS ${q(field.name)}`)
    .join(', ');
  const rows = ctx.db
    .prepare(`SELECT ${columns} FROM ${q(projection.table)} WHERE ${q(foreignField.column)} = ? LIMIT 1`)
    .all(value) as Row[];
  return rows[0] ?? null;
}

function compareValues(a: unknown, b: unknown, nulls: 'first' | 'last'): number {
  const aNull = a === null || a === undefined;
  const bNull = b === null || b === undefined;
  if (aNull || bNull) {
    if (aNull && bNull) return 0;
    return aNull ? (nulls === 'first' ? -1 : 1) : (nulls === 'first' ? 1 : -1);
  }
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}

function q(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}
