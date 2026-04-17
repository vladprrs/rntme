/**
 * Source for one SQL-bound value when applying an event. Resolved at compile
 * time (once per projection/handler), consumed at runtime (once per envelope).
 *
 * - `aggregateId`       — `envelope.rntAggregateId`, coerced to the entity's key type
 * - `payloadField`      — `envelope.data.after[fieldName]`
 * - `generatedOccurred` — `envelope.time` (for `generated: "createdAt" | "updatedAt"`)
 * - `generatedActor`    — `envelope.rntActorId`
 * - `nullable`          — literal NULL (column nullable + not in affects + not generated)
 * - `literalString`     — compile-time string (e.g. creation transition target for state column)
 * - `eventId`           — idempotency column `last_event_id` (source: `envelope.id`)
 * - `eventVersion`      — idempotency column `last_event_version` (source: `envelope.rntVersion`)
 * - `appliedAt`         — idempotency column `applied_at` = new Date().toISOString()
 */
export type ColumnBinding =
  | Readonly<{ kind: 'aggregateId'; sqlType: 'INTEGER' | 'TEXT' | 'REAL' }>
  | Readonly<{ kind: 'payloadField'; fieldName: string }>
  | Readonly<{ kind: 'generatedOccurred' }>
  | Readonly<{ kind: 'generatedActor' }>
  | Readonly<{ kind: 'nullable' }>
  | Readonly<{ kind: 'literalString'; value: string }>
  | Readonly<{ kind: 'eventId' }>
  | Readonly<{ kind: 'eventVersion' }>
  | Readonly<{ kind: 'appliedAt' }>;

/**
 * Compiled SQL + param bindings for one (projectionName, eventType) pair.
 * `kind: 'insert'` is used for creation transitions (payload.before === null),
 * `kind: 'update'` for all others (including self-loops).
 */
export type CompiledHandler =
  | Readonly<{
      kind: 'insert';
      projectionName: string;
      tableName: string;
      aggregateType: string;
      eventType: string;
      /** Single-element key column for MVP; composite keys rejected at compile. */
      keyColumn: string;
      sql: string;
      bindings: readonly ColumnBinding[];
    }>
  | Readonly<{
      kind: 'update';
      projectionName: string;
      tableName: string;
      aggregateType: string;
      eventType: string;
      keyColumn: string;
      sql: string;
      bindings: readonly ColumnBinding[];
    }>;

/** Compiled plan: eventType → handler. */
export type ApplyPlan = Readonly<{
  handlersByEventType: ReadonlyMap<string, CompiledHandler>;
  /** Lookup: aggregateType → whether a mirror projection exists. */
  mirrorsByAggregate: ReadonlyMap<string, CompiledHandler['tableName']>;
}>;

export type ApplyResult = 'applied' | 'skipped-no-mirror' | 'skipped-older-version';
