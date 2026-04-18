import type { Database as BetterSqliteDatabase } from 'better-sqlite3';
import type { EventEnvelope } from '@rntme/event-store';
import type {
  ApplyPlan,
  ApplyResult,
  CompiledHandler,
  MirrorHandler,
  DerivedHandler,
} from '../types/apply.js';
import { bindValues, bindDerivedValue } from './bind.js';

/**
 * Apply one event envelope to every handler registered for its eventType.
 *
 * Two handler kinds are supported (spec §6.5):
 *
 *   • Mirror handlers (insert/update) — entity-mirror projections. Idempotent
 *     via (a) last_event_version pre-check + (b) conditional UPSERT/UPDATE
 *     with a last_event_version guard.
 *
 *   • Derived handlers — aggregation / filter projections compiled from the
 *     graph-IR event-delta lowering. Idempotent via the seen_events
 *     side-table keyed on (event_id, projection_id); an optional predicate
 *     filter runs before the UPSERT to skip envelopes that do not match.
 *
 * Returns one `ApplyResult` per handler that was consulted (in the order
 * stored in the plan: mirror-first, then derived sorted by projectionName).
 * If no handler matches the envelope's eventType the function returns the
 * single-element array `['skipped-no-handler']`.
 */
export function applyEvent(
  db: BetterSqliteDatabase,
  plan: ApplyPlan,
  envelope: EventEnvelope,
): readonly ApplyResult[] {
  const handlers = plan.handlersByEventType.get(envelope.eventType) ?? [];
  if (handlers.length === 0) return ['skipped-no-handler'];

  const results: ApplyResult[] = [];
  for (const handler of handlers) {
    results.push(applyOne(db, handler, envelope));
  }
  return results;
}

function applyOne(
  db: BetterSqliteDatabase,
  handler: CompiledHandler,
  envelope: EventEnvelope,
): ApplyResult {
  if (handler.kind === 'insert' || handler.kind === 'update') {
    return applyMirror(db, handler, envelope);
  }
  return applyDerived(db, handler, envelope);
}

function applyMirror(
  db: BetterSqliteDatabase,
  handler: MirrorHandler,
  envelope: EventEnvelope,
): ApplyResult {
  if (handler.aggregateType !== envelope.aggregateType) return 'skipped-no-handler';

  const currentVersion = selectCurrentVersion(db, handler, envelope.aggregateId);
  if (currentVersion !== null && currentVersion >= envelope.version) {
    return 'skipped-older-version';
  }

  const params = bindValues(handler, envelope);
  const info = db.prepare(handler.sql).run(...params);
  return info.changes > 0 ? 'applied' : 'skipped-older-version';
}

function applyDerived(
  db: BetterSqliteDatabase,
  handler: DerivedHandler,
  envelope: EventEnvelope,
): ApplyResult {
  // 1. Filter predicate. Task 12 inlines literals so bindings is typically
  //    empty, but we bind positional params for safety in case a future
  //    lowering needs them.
  if (handler.filter) {
    const filterParams = handler.filter.bindings.map((b) => bindDerivedValue(b, envelope));
    const sql = `SELECT 1 AS ok WHERE ${handler.filter.sql}`;
    const row = db.prepare(sql).get(...filterParams) as { ok: number } | undefined;
    if (!row) return 'skipped-filter';
  }

  // 2. Seen-events idempotency gate keyed on (event_id, projection_id).
  const seen = db
    .prepare('SELECT 1 AS ok FROM seen_events WHERE event_id = ? AND projection_id = ?')
    .get(envelope.eventId, handler.projectionName) as { ok: number } | undefined;
  if (seen) return 'skipped-seen-event';

  // 3. Delta UPSERT. Params are materialised from the ordered deltaBindings.
  const deltaParams = handler.deltaBindings.map((b) => bindDerivedValue(b, envelope));
  db.prepare(handler.deltaSql).run(...deltaParams);

  // 4. Record the applied event so re-delivery short-circuits at step 2.
  db.prepare(
    'INSERT INTO seen_events (event_id, projection_id, applied_at) VALUES (?, ?, ?)',
  ).run(envelope.eventId, handler.projectionName, new Date().toISOString());

  return 'applied';
}

function selectCurrentVersion(
  db: BetterSqliteDatabase,
  handler: MirrorHandler,
  aggregateId: string,
): number | null {
  const sql = `SELECT "last_event_version" AS v FROM "${handler.tableName}" WHERE "${handler.keyColumn}" = ?`;
  // MVP: integer-key vs text-key coercion matches bind.ts's aggregateId binding.
  const keyBinding = handler.bindings.find((b) => b.kind === 'aggregateId')!;
  const key =
    keyBinding.kind === 'aggregateId' && keyBinding.sqlType === 'INTEGER'
      ? Number(aggregateId)
      : aggregateId;
  const row = db.prepare(sql).get(key) as { v: number } | undefined;
  return row ? row.v : null;
}
