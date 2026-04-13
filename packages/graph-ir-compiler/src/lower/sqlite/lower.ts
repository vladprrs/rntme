import type { RelOp, RelScan } from '../../types/relational.js';
import type { SqlSelect, SqlExpr } from './ast.js';

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
    default:
      throw new Error(`lowerToSqlite: operator ${rel.op} not yet supported`);
  }
}

function paramPlaceholder(name: string, paramOrder: string[]): SqlExpr {
  paramOrder.push(name);
  return { kind: 'param', ordinal: paramOrder.length - 1 };
}
