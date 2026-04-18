import type { Expr } from './authoring.js';

/**
 * Optional SQL descriptor for a virtual scan column. Kept as a minimal shape (not the full
 * SqlExpr AST) so `types/` stays independent of `lower/sqlite/`. Lowering resolves this into
 * an SqlExpr. Currently only `json_extract` is needed (event_log payload fields).
 */
export type RelFieldSql = { fn: 'json_extract'; column: string; jsonPath: string };

export type RelField = {
  name: string;
  column: string;
  type: string;
  nullable: boolean;
  /** If set, the scan's SELECT emits this expression instead of a bare column ref. */
  sql?: RelFieldSql;
};

/** Scan-level constant predicate; produces `<alias>.<column> = '<value>'` in lowering. */
export type RelScanWhere = { kind: 'eq_literal'; column: string; value: string };

export type RelScan = {
  op: 'Scan';
  table: string;
  alias: string;
  fields: RelField[];
  /** Root PDM entity; required for multi-segment field paths in lowering. */
  entity?: string;
  /** Optional constant predicate injected into WHERE (e.g. event_type = 'OrderCreate'). */
  where?: RelScanWhere;
};

export type RelFilter = { op: 'Filter'; child: RelOp; predicate: Expr };

export type RelProject = {
  op: 'Project';
  child: RelOp;
  into: string;
  cols: Record<string, { expr: Expr }>;
};

export type RelAggregate = {
  op: 'Aggregate';
  child: RelOp;
  into: string;
  group: Record<string, string>;
  measures: Record<string, { fn: string; expr?: Expr }>;
};

export type RelSort = {
  op: 'Sort';
  child: RelOp;
  keys: Array<{ field: string; dir: 'asc' | 'desc'; nulls: 'first' | 'last' }>;
};

export type RelLimit = { op: 'Limit'; child: RelOp; count: number | { $param: string } };

export type RelJoin = {
  op: 'Join';
  left: RelOp;
  right: RelOp;
  on: { leftCol: string; rightCol: string };
  kind: 'inner' | 'left';
  rightAlias: string;
};

export type RelOp = RelScan | RelFilter | RelProject | RelAggregate | RelSort | RelLimit | RelJoin;
