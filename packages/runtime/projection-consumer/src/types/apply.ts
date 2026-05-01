import type { DerivedColumnBinding } from '@rntme/graph-ir-compiler';

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
 * Compiled SQL + param bindings for an entity-mirror projection, keyed by
 * (projectionName, eventType). `kind: 'insert'` is used for creation
 * transitions (payload.before === null), `kind: 'update'` for all others
 * (including self-loops).
 */
export type MirrorHandler =
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

/**
 * Compiled UPSERT + filter + `seen_events` metadata for a `backing: "derived"`
 * projection, produced by `@rntme/graph-ir-compiler`'s `compileProjectionGraph`
 * event-delta lowering and passed into `compileApplyPlan` as
 * `derivedHandlers`. Applied idempotently per envelope via the `seen_events`
 * table (composite key `event_id, projection_id`).
 */
export type DerivedHandler = Readonly<{
  kind: 'derived';
  projectionName: string;
  tableName: string;
  aggregateType: string;
  eventType: string;
  deltaSql: string;
  bootstrapSql: string;
  deltaBindings: readonly DerivedColumnBinding[];
  filter: Readonly<{ sql: string; bindings: readonly DerivedColumnBinding[] }> | null;
}>;

export type CompiledHandler = MirrorHandler | DerivedHandler;

/**
 * Compiled plan: eventType → ordered list of handlers (mirror first, then
 * derived handlers sorted by projectionName for determinism).
 */
export type ApplyPlan = Readonly<{
  handlersByEventType: ReadonlyMap<string, readonly CompiledHandler[]>;
  /** Lookup: aggregateType → mirror table name for that aggregate (if any). */
  mirrorsByAggregate: ReadonlyMap<string, string>;
}>;

/**
 * Per-handler apply outcome. `applyEvent` returns one result per handler that
 * matched `envelope.eventType` (in handler order); `skipped-no-handler` is
 * returned as a single-element array when no handler matches.
 *
 * - `applied`                — handler wrote a row (mirror UPSERT or derived UPSERT + seen_events insert).
 * - `skipped-no-handler`     — no handler for this eventType (or mirror handler rejected the aggregateType).
 * - `skipped-older-version`  — mirror idempotency guard: projection already at-or-ahead of this event.
 * - `skipped-seen-event`     — derived idempotency guard: (eventId, projectionName) already in seen_events.
 * - `skipped-filter`         — derived filter predicate evaluated false for this envelope.
 */
export type ApplyResult =
  | 'applied'
  | 'skipped-no-handler'
  | 'skipped-older-version'
  | 'skipped-seen-event'
  | 'skipped-filter';
