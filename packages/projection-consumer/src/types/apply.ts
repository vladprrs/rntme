/**
 * Source for one SQL-bound value when applying an event. Resolved at compile
 * time (once per projection/handler), consumed at runtime (once per envelope).
 *
 * - `aggregateId`       — `envelope.aggregateId`, coerced to the entity's key type
 * - `payloadField`      — `envelope.payload.after[fieldName]`
 * - `generatedOccurred` — `envelope.occurredAt` (for `generated: "createdAt" | "updatedAt"`)
 * - `generatedActor`    — `envelope.actor?.id ?? null`
 * - `nullable`          — literal NULL (column nullable + not in affects + not generated)
 * - `eventId`           — idempotency column `last_event_id`
 * - `eventVersion`      — idempotency column `last_event_version`
 * - `appliedAt`         — idempotency column `applied_at` = new Date().toISOString()
 */
export type ColumnBinding =
  | Readonly<{ kind: 'aggregateId'; sqlType: 'INTEGER' | 'TEXT' | 'REAL' }>
  | Readonly<{ kind: 'payloadField'; fieldName: string }>
  | Readonly<{ kind: 'generatedOccurred' }>
  | Readonly<{ kind: 'generatedActor' }>
  | Readonly<{ kind: 'nullable' }>
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
