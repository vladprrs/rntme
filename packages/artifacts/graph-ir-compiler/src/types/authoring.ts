export type InputMode = 'root' | 'required' | 'nullable' | 'defaulted' | 'predicate_optional';

export type PrimitiveType = 'integer' | 'long' | 'decimal' | 'string' | 'boolean' | 'date' | 'datetime';
export type ListType = { list: PrimitiveType };
export type RowType = { row: string };
export type RowsetType = { rowset: string };
export type InputType = PrimitiveType | ListType | RowType | RowsetType;

export type InputDecl = {
  type: InputType;
  mode: InputMode;
  default?: unknown;
};

export type FieldDecl = { type: PrimitiveType; nullable: boolean };
export type NamedShape = { fields: Record<string, FieldDecl> };

export type SignatureOutput = { type: string; from: string };
export type Signature = { inputs: Record<string, InputDecl>; output: SignatureOutput };

export type FieldPath = string;

export type ExprOp =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'add'
  | 'sub'
  | 'mul'
  | 'div'
  | 'and'
  | 'or'
  | 'not'
  | 'is_null'
  | 'like'
  | 'in'
  | 'concat'
  | 'coalesce';

export type Expr =
  | FieldPath
  | number
  | boolean
  | null
  | { $literal: unknown }
  | { $param: string }
  | { $ref: string }
  | { $node: string }
  | { [K in ExprOp]?: Expr[] }
  | { between: [Expr, Expr, Expr] }
  | { case: { when: Array<[Expr, Expr]>; else: Expr } }
  | { exists: { relation: string; where?: Expr } }
  | { $list: Expr[] };

export type FieldExpr =
  | FieldPath
  | Expr
  | {
      lookup: {
        entity: string;
        path?: string;
        match: Record<string, FieldPath>;
        field: string;
        optional?: boolean;
      };
    };

export type FindManySource =
  | { entity: string }
  | { projection: string }
  | { eventType: string };

export type FindManyNode = {
  id: string;
  type: 'findMany';
  config: {
    source: FindManySource;
  };
};

export type FindOneNode = {
  id: string;
  type: 'findOne';
  config: {
    source: FindManySource;
    where: Expr;
  };
};

export type FilterNode = {
  id: string;
  type: 'filter';
  config: { input: string; expr?: Expr; predicate?: string };
};

export type MapNode = {
  id: string;
  type: 'map';
  config: { input: string; into: string; fields: Record<string, FieldExpr> };
};

export type AggregateFn = 'count' | 'count_distinct' | 'sum' | 'avg' | 'min' | 'max' | 'group_array';

export type MeasureSpec = { fn: AggregateFn; expr?: Expr };

export type ReduceNode = {
  id: string;
  type: 'reduce';
  config: {
    input: string;
    into: string;
    group: Record<string, FieldPath>;
    measures: Record<string, MeasureSpec>;
  };
};

export type SortDir = 'asc' | 'desc';
export type SortNulls = 'first' | 'last';
export type SortKey = { field: FieldPath; dir?: SortDir; nulls?: SortNulls };

export type SortNode = { id: string; type: 'sort'; config: { input: string; by: SortKey[] } };

export type LimitCount = number | { $param: string };
export type LimitNode = { id: string; type: 'limit'; config: { input: string; count: LimitCount } };

export type DistinctNode = { id: string; type: 'distinct'; config: { input: string } };
export type LookupOneNode = {
  id: string;
  type: 'lookupOne';
  config: {
    input: string;
    entity: string;
    as: string;
    match: Record<string, FieldPath>;
    optional?: boolean;
    path?: string;
  };
};

export type UuidNode = {
  id: string;
  type: 'uuid';
  config: Record<string, never>;
};

export type EmitNode = {
  id: string;
  type: 'emit';
  config: {
    aggregate: string;
    aggregateId: Expr;
    transition: string;
    payload: Record<string, Expr>;
    actor?: Expr;
  };
};

export type CallPolicy = {
  timeoutMs: number;
  retry?: { attempts?: number; retryOn?: 'never' | 'transient' | 'all' };
  idempotency?: { mode: 'inherit' | 'none' | 'derive'; key?: Expr };
  onError: 'fail';
};

export type CallNode = {
  id: string;
  type: 'call';
  target: { module: string; operation: string } | { service: string; operation: string };
  input: Record<string, Expr>;
  policy: CallPolicy;
};

export type BranchCase = { when: Expr; then: string } | { default: true; then: string };

export type BranchNode = {
  id: string;
  type: 'branch';
  cases: BranchCase[];
};

export type ResultNode = {
  id: string;
  type: 'result';
  value: Record<string, Expr> | Expr;
};

export type GraphNode =
  | FindManyNode
  | FindOneNode
  | FilterNode
  | MapNode
  | ReduceNode
  | SortNode
  | LimitNode;

export type AnyGraphNode =
  | GraphNode
  | DistinctNode
  | LookupOneNode
  | UuidNode
  | EmitNode
  | CallNode
  | BranchNode
  | ResultNode;

export type GraphDecl = {
  id: string;
  signature: Signature;
  nodes: AnyGraphNode[];
};

export type AuthoringSpec = {
  version: '1.0-rc7';
  pdmRef: string;
  qsmRef: string;
  shapes: Record<string, NamedShape>;
  graphs: Record<string, GraphDecl>;
};
