export type SqlExpr =
  | { kind: 'col'; table?: string; column: string }
  | { kind: 'num'; value: number }
  | { kind: 'str'; value: string }
  | { kind: 'bool'; value: boolean }
  | { kind: 'null' }
  | { kind: 'param'; ordinal: number }
  | { kind: 'op'; op: string; args: SqlExpr[] }
  | { kind: 'between'; expr: SqlExpr; low: SqlExpr; high: SqlExpr }
  | { kind: 'case'; when: Array<[SqlExpr, SqlExpr]>; else: SqlExpr }
  | { kind: 'agg'; fn: string; args: SqlExpr[]; distinct?: boolean }
  | { kind: 'func'; name: string; args: SqlExpr[] };

export type SqlFromTable = { table: string; alias: string };

export type SqlJoin = {
  kind: 'inner' | 'left';
  table: string;
  alias: string;
  on: SqlExpr;
};

export type SqlOrderKey = {
  expr: SqlExpr;
  dir: 'asc' | 'desc';
  nulls: 'first' | 'last';
};

export type SqlSelect = {
  kind: 'select';
  columns: Array<{ expr: SqlExpr; alias: string }>;
  from: SqlFromTable;
  joins: SqlJoin[];
  where?: SqlExpr;
  groupBy?: SqlExpr[];
  having?: SqlExpr;
  orderBy?: SqlOrderKey[];
  limit?: SqlExpr;
};
