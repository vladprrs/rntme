import type { EventEnvelope, EventStore } from '@rntme/event-store';
import { ConcurrencyConflict } from '@rntme/event-store';
import type { ApplyMode, ApplyResult, SeedError, ValidatedSeed } from './types.js';

export type ApplySeedOptions = Readonly<{
  mode?: ApplyMode;
  serviceName: string;
}>;

/**
 * - **strict**: empty store only; append all events.
 * - **upsertByEventId**: skip events whose `id` is already in the store, then append
 *   the rest with `ignoreDuplicates: true`. (Re-applying the same seed must not re-insert
 *   the same `(subject, rntVersion)` rows — SQLite would reject them even when `id` matches.)
 *
 * `opts.serviceName` is required. The CE derived fields (source/type/dataSchema)
 * were already baked during `validateSeed`, but we require `serviceName` for
 * symmetry with `SqliteEventStore` — enforces that callers are aware of the
 * service context they are seeding.
 */
export async function applySeed(
  seed: ValidatedSeed,
  eventStore: EventStore,
  opts: ApplySeedOptions,
): Promise<ApplyResult> {
  if (!opts || typeof opts !== 'object') {
    return Promise.reject(
      new Error('applySeed: opts is required and must include serviceName'),
    );
  }
  if (!opts.serviceName || opts.serviceName.length === 0) {
    return Promise.reject(new Error('applySeed: opts.serviceName is required'));
  }

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
  const seenIds = new Set(records.map((r) => r.envelope.id));
  const toAppend: EventEnvelope[] = [];
  let skippedCount = 0;
  for (const e of seed.events) {
    if (seenIds.has(e.id)) {
      skippedCount += 1;
    } else {
      seenIds.add(e.id);
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
      message: `UNIQUE(subject, version) conflict during applySeed: ${err.message}`,
      details: {
        subject: err.subject,
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
    if (/subject.*version|version.*subject/.test(msg)) {
      return {
        code: 'SEED_STREAM_VERSION_CONFLICT',
        message: `UNIQUE(subject, version) conflict during applySeed: ${msg}`,
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
