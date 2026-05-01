import type { Expr } from './authoring.js';
import type { RelFieldSql, RelScanWhere } from './relational.js';

export type Cardinality = 'row' | 'rowset';

export type ScanStep = {
  kind: 'scan';
  nodeId: string;
  table: string;
  alias: string;
  /** PDM entity name for the scan root (dot-navigation / JOIN synthesis). */
  entity: string;
  /** Virtual columns; `sql` marks ones that lower to a non-trivial expression. */
  fields: Array<{ name: string; column: string; type: string; nullable: boolean; sql?: RelFieldSql }>;
  /** Optional scan-level constant predicate (e.g. event_type = 'OrderCreate'). */
  where?: RelScanWhere;
};

export type LimitStep = {
  kind: 'limit';
  nodeId: string;
  count: number | { $param: string };
};

export type FilterStep = { kind: 'filter'; nodeId: string; predicate: Expr };

export type ProjectStep = {
  kind: 'project';
  nodeId: string;
  into: string;
  fields: Record<string, { expr: Expr }>;
};

export type AggregateStep = {
  kind: 'aggregate';
  nodeId: string;
  into: string;
  group: Record<string, string>;
  measures: Record<string, { fn: string; expr?: Expr }>;
};

export type SortStep = {
  kind: 'sort';
  nodeId: string;
  by: Array<{ field: string; dir: 'asc' | 'desc'; nulls: 'first' | 'last' }>;
};

export type PlanStep = ScanStep | FilterStep | ProjectStep | AggregateStep | SortStep | LimitStep;

export type SemanticPlan = {
  graphId: string;
  outputNodeId: string;
  outputShape: string;
  cardinality: Cardinality;
  steps: PlanStep[];
};
