import type { Database as BetterSqliteDatabase } from 'better-sqlite3';
import type { EventEnvelope } from '@rntme/event-store';
import type { ApplyPlan, ApplyResult, MirrorHandler } from '../types/apply.js';
import { bindValues } from './bind.js';

/**
 * Apply one event envelope to every handler registered for its eventType.
 *
 * Task 18 scope (this commit): mirror-only — derived handlers are wired in
 * Task 20. Returns a per-handler result array; an envelope with no matching
 * handlers yields `['skipped-no-handler']`.
 *
 * Mirror idempotency (spec §6.5):
 *   1. pre-check: SELECT last_event_version WHERE key = ?; skip if row.version ≥ ev.version
 *   2. INSERT ON CONFLICT DO UPDATE WHERE excluded.version > current (for creation)
 *   3. UPDATE ... WHERE version < new (for non-creation)
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
    if (handler.kind === 'insert' || handler.kind === 'update') {
      results.push(applyMirror(db, handler, envelope));
    } else {
      // Task 20 wires 'derived' handlers; until then we silently skip any
      // derived handler rather than crash if one slips into the plan.
      results.push('skipped-no-handler');
    }
  }
  return results;
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
