import type { Database as BetterSqliteDatabase } from 'better-sqlite3';
import type { EventEnvelope } from '@rntme/event-store';
import type { ApplyPlan, ApplyResult, CompiledHandler } from '../types/apply.js';
import { bindValues } from './bind.js';

/**
 * Apply one event envelope to its entity-mirror projection.
 * Idempotency layers (spec §6.5):
 *   1. pre-check: SELECT last_event_version WHERE key = ?; skip if row.version ≥ ev.version
 *   2. INSERT ON CONFLICT DO UPDATE WHERE excluded.version > current (for creation)
 *   3. UPDATE ... WHERE version < new (for non-creation)
 * Returns:
 *   - 'skipped-no-mirror'      — aggregateType has no entity-mirror, or eventType not in plan
 *   - 'skipped-older-version'  — projection already at-or-ahead of this event
 *   - 'applied'                — row inserted or updated
 */
export function applyEvent(
  db: BetterSqliteDatabase,
  plan: ApplyPlan,
  envelope: EventEnvelope,
): ApplyResult {
  const handler = plan.handlersByEventType.get(envelope.eventType);
  if (!handler) return 'skipped-no-mirror';
  if (handler.aggregateType !== envelope.aggregateType) return 'skipped-no-mirror';

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
  handler: CompiledHandler,
  aggregateId: string,
): number | null {
  const sql = `SELECT "last_event_version" AS v FROM "${handler.tableName}" WHERE "${handler.keyColumn}" = ?`;
  // MVP: integer-key vs text-key coercion matches bind.ts's aggregateId binding.
  const keyBinding = handler.bindings.find((b) => b.kind === 'aggregateId')!;
  const key = keyBinding.kind === 'aggregateId' && keyBinding.sqlType === 'INTEGER'
    ? Number(aggregateId)
    : aggregateId;
  const row = db.prepare(sql).get(key) as { v: number } | undefined;
  return row ? row.v : null;
}
