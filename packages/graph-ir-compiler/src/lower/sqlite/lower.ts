import type { RelOp, RelScan } from '../../types/relational.js';
import type { SqlSelect, SqlExpr } from './ast.js';
import { lowerExpr } from './expr.js';

export type LowerResult = { ast: SqlSelect; paramOrder: string[] };

export function lowerToSqlite(rel: RelOp): LowerResult {
  const paramOrder: string[] = [];

  const ast = toSelect(rel, paramOrder);
  return { ast, paramOrder };
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

function toSelect(rel: RelOp, paramOrder: string[]): SqlSelect {
  switch (rel.op) {
    case 'Scan':
      return scanToSelect(rel);
    case 'Limit': {
      const child = toSelect(rel.child, paramOrder);
      child.limit =
        typeof rel.count === 'number'
          ? { kind: 'num', value: rel.count }
          : paramPlaceholder(rel.count.$param, paramOrder);
      return child;
    }
    case 'Filter': {
      const child = toSelect(rel.child, paramOrder);
      const scanMeta = findScanMeta(rel);
      const predicate = lowerExpr(rel.predicate, {
        alias: scanMeta.alias,
        columnOf: (path) => columnOfFromScan(path, scanMeta),
        paramOrder,
      });
      child.where = child.where ? { kind: 'op', op: 'and', args: [child.where, predicate] } : predicate;
      return child;
    }
    default:
      throw new Error(`lowerToSqlite: operator ${rel.op} not yet supported`);
  }
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
