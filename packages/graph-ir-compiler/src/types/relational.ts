import type { Expr } from './authoring.js';

export type RelField = { name: string; column: string; type: string; nullable: boolean };

export type RelScan = {
  op: 'Scan';
  table: string;
  alias: string;
  fields: RelField[];
  /** Root PDM entity; required for multi-segment field paths in lowering. */
  entity?: string;
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
