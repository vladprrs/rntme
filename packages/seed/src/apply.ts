import type { EventEnvelope, EventStore } from '@rntme/event-store';
import { ConcurrencyConflict } from '@rntme/event-store';
import type { ApplyMode, ApplyResult, SeedError, ValidatedSeed } from './types.js';

/**
 * - **strict**: empty store only; append all events.
 * - **upsertByEventId**: skip events whose `eventId` is already in the store, then append
 *   the rest with `ignoreDuplicates: true`. (Re-applying the same seed must not re-insert
 *   the same `(stream, version)` rows — SQLite would reject them even when `eventId` matches.)
 */
export async function applySeed(
  seed: ValidatedSeed,
  eventStore: EventStore,
  opts: { mode?: ApplyMode } = {},
): Promise<ApplyResult> {
  const mode = opts.mode ?? 'strict';

  if (mode === 'strict') {
    const before = countEvents(eventStore);
    if (before > 0) {
      return Promise.reject(errSeedStoreNotEmpty(before));
    }
    try {
      eventStore.appendRaw(seed.events);
    } catch (err) {
      return Promise.reject(mapApplyError(err));
    }
    return { appliedCount: seed.events.length, skippedCount: 0 };
  }

  const records = eventStore.readRecordsFrom({ afterId: 0, limit: 1_000_000 });
  const seenIds = new Set(records.map((r) => r.envelope.eventId));
  const toAppend: EventEnvelope[] = [];
  let skippedCount = 0;
  for (const e of seed.events) {
    if (seenIds.has(e.eventId)) {
      skippedCount += 1;
    } else {
      seenIds.add(e.eventId);
      toAppend.push(e);
    }
  }
  try {
    if (toAppend.length > 0) {
      eventStore.appendRaw(toAppend, { ignoreDuplicates: true });
    }
  } catch (err) {
    return Promise.reject(mapApplyError(err));
  }
  return { appliedCount: toAppend.length, skippedCount };
}

function countEvents(store: EventStore): number {
  return store.readRecordsFrom({ afterId: 0, limit: 1_000_000 }).length;
}

function errSeedStoreNotEmpty(count: number): SeedError {
  return {
    code: 'SEED_STORE_NOT_EMPTY',
    message: `Event store is not empty (${count} events). Strict mode refuses to apply. Use mode: 'upsertByEventId' for incremental seeding.`,
    details: { count: String(count) },
  };
}

function mapApplyError(err: unknown): SeedError {
  if (err instanceof ConcurrencyConflict) {
    return {
      code: 'SEED_STREAM_VERSION_CONFLICT',
      message: `UNIQUE(stream, version) conflict during applySeed: ${err.message}`,
      details: {
        stream: err.stream,
        expectedVersion:
          err.expectedVersion === undefined ? '' : String(err.expectedVersion),
        actualVersion: String(err.actualVersion),
      },
    };
  }
  if (!(err instanceof Error)) {
    return { code: 'SEED_APPLY_IO', message: String(err) };
  }
  const msg = err.message;
  const code = (err as Error & { code?: string }).code ?? '';
  if (code === 'SQLITE_CONSTRAINT_UNIQUE' || code === 'SQLITE_CONSTRAINT') {
    if (/stream.*version|version.*stream/.test(msg)) {
      return {
        code: 'SEED_STREAM_VERSION_CONFLICT',
        message: `UNIQUE(stream, version) conflict during applySeed: ${msg}`,
        details: { sqliteCode: code },
      };
    }
    if (/event_id/.test(msg)) {
      return {
        code: 'SEED_STREAM_VERSION_CONFLICT',
        message: `UNIQUE event_id conflict during applySeed (should have been ignored): ${msg}`,
        details: { sqliteCode: code },
      };
    }
  }
  return { code: 'SEED_APPLY_IO', message: msg, details: { sqliteCode: code } };
}
