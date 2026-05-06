import type { Expr, FieldExpr, SortKey, AggregateFn, CallPolicy } from './authoring.js';
import type { Signature } from './authoring.js';
import type { OperationTarget } from './operation.js';

export type ScopeId = string;

export type CanonicalFindMany = {
  kind: 'findMany';
  id: string;
  scope: ScopeId;
  source: { entity: string } | { projection: string } | { eventType: string };
  alias: string;
};

export type CanonicalFindOne = {
  kind: 'findOne';
  id: string;
  scope: ScopeId;
  source: { entity: string } | { projection: string } | { eventType: string };
  alias: string;
  where: Expr;
};

export type CanonicalFilter = {
  kind: 'filter';
  id: string;
  scope: ScopeId;
  input: string;
  expr: Expr;
};

export type CanonicalMap = {
  kind: 'map';
  id: string;
  scope: ScopeId;
  input: string;
  into: string;
  fields: Record<string, FieldExpr>;
};

export type CanonicalMeasure = { fn: AggregateFn; expr?: Expr };

export type CanonicalReduce = {
  kind: 'reduce';
  id: string;
  scope: ScopeId;
  input: string;
  into: string;
  group: Record<string, string>;
  measures: Record<string, CanonicalMeasure>;
};

export type CanonicalSort = {
  kind: 'sort';
  id: string;
  scope: ScopeId;
  input: string;
  by: Required<SortKey>[];
};

export type CanonicalLimit = {
  kind: 'limit';
  id: string;
  scope: ScopeId;
  input: string;
  count: number | { $param: string };
};

export type CanonicalUuid = {
  kind: 'uuid';
  id: string;
  scope: ScopeId;
};

export type CanonicalEmit = {
  kind: 'emit';
  id: string;
  scope: ScopeId;
  aggregate: string;
  aggregateId: Expr;
  transition: string;
  payload: Record<string, Expr>;
  actor?: Expr;
};

export type CanonicalCall = {
  kind: 'call';
  id: string;
  scope: ScopeId;
  target: OperationTarget;
  input: Record<string, Expr>;
  policy: CallPolicy;
};

export type CanonicalBranch = {
  kind: 'branch';
  id: string;
  scope: ScopeId;
  cases: Array<{ when: Expr; then: string } | { default: true; then: string }>;
};

export type CanonicalResult = {
  kind: 'result';
  id: string;
  scope: ScopeId;
  value: Record<string, Expr> | Expr;
};

export type CanonicalNode =
  | CanonicalFindMany
  | CanonicalFindOne
  | CanonicalFilter
  | CanonicalMap
  | CanonicalReduce
  | CanonicalSort
  | CanonicalLimit
  | CanonicalUuid
  | CanonicalEmit
  | CanonicalCall
  | CanonicalBranch
  | CanonicalResult;

export type CanonicalGraph = {
  id: string;
  signature: Signature;
  rootScope?: ScopeId;
  nodes: CanonicalNode[];
  outputFrom: string;
};
