import type Database from 'better-sqlite3';
import { createQsmResolver, type ValidatedQsm } from '@rntme/qsm';
import { runtimeError } from '../types/errors.js';
import type { CanonicalFindOne } from '../types/canonical.js';
import { evalOperationExpr, type NodeOutputs } from './eval.js';

export function executeFindOne(
  node: CanonicalFindOne,
  params: Record<string, unknown>,
  outputs: NodeOutputs,
  db: Database.Database,
  qsm: ValidatedQsm,
): Record<string, unknown> | null {
  if (!('projection' in node.source)) {
    throw runtimeError('RUNTIME_INTERNAL_ERROR', 'findOne MVP supports projection sources only');
  }
  const where = node.where;
  if (typeof where !== 'object' || where === null || !('eq' in where)) {
    throw runtimeError('RUNTIME_INTERNAL_ERROR', 'findOne MVP supports eq predicate only');
  }
  const [field, rhs] = where.eq as [string, unknown];
  if (typeof field !== 'string') {
    throw runtimeError('RUNTIME_INTERNAL_ERROR', 'findOne lhs must be a field path');
  }
  const column = field.split('.').at(-1)!;
  const value = evalOperationExpr(rhs as ExprForLocalRead, params, outputs);
  const projection = createQsmResolver(qsm).resolveProjection(node.source.projection);
  if (projection === null) {
    throw runtimeError('RUNTIME_INTERNAL_ERROR', `projection "${node.source.projection}" not found`);
  }
  const rows = db
    .prepare(`SELECT * FROM "${projection.table}" WHERE "${column}" = ?`)
    .all(value) as Record<string, unknown>[];
  if (rows.length > 1) {
    throw runtimeError('RUNTIME_INTERNAL_ERROR', `findOne "${node.id}" matched ${rows.length} rows`);
  }
  return rows[0] ?? null;
}

type ExprForLocalRead = Parameters<typeof evalOperationExpr>[0];
