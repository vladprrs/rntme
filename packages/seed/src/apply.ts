import {
  ConcurrencyConflict,
  type EventEnvelope,
  type SqliteEventStore,
} from '@rntme/event-store';
import type { ApplyMode, ApplyResult, SeedError, ValidatedSeed } from './types.js';

function errSeedStoreNotEmpty(existingCount: number): SeedError {
  return {
    code: 'SEED_STORE_NOT_EMPTY',
    message: `event store is not empty (${existingCount} event(s)); strict seed apply requires an empty store`,
    details: { existingCount: String(existingCount) },
  };
}

function mapApplyError(err: unknown): SeedError {
  if (err instanceof ConcurrencyConflict) {
    return {
      code: 'SEED_STREAM_VERSION_CONFLICT',
      message: err.message,
      details: {
        stream: err.stream,
        expectedVersion:
          err.expectedVersion === undefined ? '' : String(err.expectedVersion),
        actualVersion: String(err.actualVersion),
      },
    };
  }
  if (err instanceof Error) {
    return { code: 'SEED_APPLY_IO', message: err.message };
  }
  return { code: 'SEED_APPLY_IO', message: String(err) };
}

function countEvents(store: SqliteEventStore): number {
  return store.readRecordsFrom({ afterId: 0, limit: 1_000_000 }).length;
}

/**
 * Appends validated seed events to the SQLite event store.
 *
 * - **strict**: requires an empty store, then appends all events (no duplicate event_id handling).
 * - **upsertByEventId**: skips events whose `eventId` is already present; uses `appendRaw` with
 *   `ignoreDuplicates` so duplicate event_ids in the batch are skipped by the store.
 */
export function applySeed(
  validated: ValidatedSeed,
  store: SqliteEventStore,
  mode: ApplyMode,
): Promise<ApplyResult> {
  const events = validated.events;
  if (mode === 'strict') {
    const before = countEvents(store);
    if (before > 0) {
      return Promise.reject(errSeedStoreNotEmpty(before));
    }
    try {
      store.appendRaw(events);
    } catch (e) {
      return Promise.reject(mapApplyError(e));
    }
    return Promise.resolve({ appliedCount: events.length, skippedCount: 0 });
  }

  const records = store.readRecordsFrom({ afterId: 0, limit: 1_000_000 });
  const seenIds = new Set(records.map((r) => r.envelope.eventId));
  const toAppend: EventEnvelope[] = [];
  let skippedCount = 0;
  for (const e of events) {
    if (seenIds.has(e.eventId)) {
      skippedCount += 1;
    } else {
      seenIds.add(e.eventId);
      toAppend.push(e);
    }
  }
  const appliedCount = toAppend.length;
  try {
    if (toAppend.length > 0) {
      store.appendRaw(toAppend, { ignoreDuplicates: true });
    }
  } catch (e) {
    return Promise.reject(mapApplyError(e));
  }
  return Promise.resolve({ appliedCount, skippedCount });
}
