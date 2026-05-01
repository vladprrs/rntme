/**
 * Shared types for the derived-projection / event-delta lowering path.
 *
 * Populated by the event-delta lowering in `lower/sqlite/event-delta/`; consumed
 * by `projection-consumer` to apply envelope events idempotently to projection
 * tables via UPSERTs, and by `qsm` to emit CREATE TABLE DDL.
 */

export type DerivedSqlType = 'INTEGER' | 'TEXT' | 'REAL';

/**
 * A binding used at delta-apply time to resolve a `?` placeholder in the
 * UPSERT statement's VALUES clause. The consumer walks these bindings per
 * envelope and produces the concrete parameter list for the prepared
 * statement.
 */
export type DerivedColumnBinding =
  | Readonly<{ kind: 'aggregateId'; sqlType: DerivedSqlType }>
  | Readonly<{ kind: 'payloadField'; fieldName: string; sqlType: DerivedSqlType }>
  | Readonly<{ kind: 'eventOccurredAt' }>
  | Readonly<{ kind: 'eventActorId' }>
  | Readonly<{ kind: 'eventId' }>
  | Readonly<{ kind: 'appliedAt' }>
  | Readonly<{ kind: 'literal'; sql: string }>
  | Readonly<{ kind: 'exprScalar'; sql: string; bindings: readonly DerivedColumnBinding[] }>;

export type DerivedMeasureColumn = Readonly<{
  name: string;
  fn: 'count' | 'sum';
  sqlType: DerivedSqlType;
  /** SQL expression used on first insert (1 for count; <expr-sql> for sum). */
  initialSql: string;
  /** SQL fragment used in ON CONFLICT DO UPDATE SET (e.g. `"count_col" + 1`). */
  deltaSql: string;
  /**
   * Bindings referenced by `initialSql` (bound for the INSERT's VALUES clause
   * at delta time). Empty for `count` (initialSql = '1'); for `sum` with a
   * payload expression, carries the nested payloadField / exprScalar bindings.
   */
  bindings?: readonly DerivedColumnBinding[];
}>;

export type DerivedGroupColumn = Readonly<{
  name: string;
  sqlType: DerivedSqlType;
  nullable: boolean;
  /** Binding used at delta-apply time to resolve this column from the envelope. */
  binding: DerivedColumnBinding;
}>;

export type DerivedTableSchema = Readonly<{
  /** Fully-qualified projection table name (filled in by caller from qsm.projections[name].table). */
  tableName: string;
  groupColumns: readonly DerivedGroupColumn[];
  measureColumns: readonly DerivedMeasureColumn[];
}>;

export type DerivedCompileResult = Readonly<{
  /** For `rntme projection rebuild`; not invoked on the hot path. */
  bootstrapSql: string;
  /** UPSERT statement, one execution per accepted envelope. */
  deltaSql: string;
  /** Parameter bindings in ?-placeholder order, matching `deltaSql`. */
  deltaBindings: readonly DerivedColumnBinding[];
  /** Optional predicate; when present, executed as `SELECT 1 WHERE <sql>` pre-upsert. */
  filter: Readonly<{ sql: string; bindings: readonly DerivedColumnBinding[] }> | null;
  /** DDL inputs for the projection table (consumer / qsm owns CREATE TABLE). */
  tableSchema: DerivedTableSchema;
  /** Event type this handler subscribes to. */
  eventType: string;
  /** For projection-consumer's `mirrorsByAggregate` map population. */
  aggregateType: string;
}>;
