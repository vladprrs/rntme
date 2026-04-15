import { describe, it, expect } from 'vitest';
import { SqliteEventStore } from '@rntme/event-store';
import { applySeed } from '../../src/apply.js';
import type { ValidatedSeed } from '../../src/types.js';

function envelope(stream: string, version: number, eventId?: string) {
  return {
    eventId: eventId ?? `seed:${stream}:v${version}`,
    eventType: 'ThingCreated',
    aggregateType: 'Thing',
    aggregateId: stream.split('-')[1] ?? '0',
    stream,
    version,
    occurredAt: '2026-01-01T00:00:00.000Z',
    actor: { kind: 'system' as const, id: 'seed' },
    payload: { name: 'x' },
    schemaVersion: 1,
  };
}

describe('applySeed — upsertByEventId mode', () => {
  it('first run applies all', async () => {
    const store = new SqliteEventStore({ filename: ':memory:' });
    const seed: ValidatedSeed = { events: [envelope('Thing-1', 1), envelope('Thing-2', 1)] };
    const r = await applySeed(seed, store, { mode: 'upsertByEventId' });
    expect(r.appliedCount).toBe(2);
    expect(r.skippedCount).toBe(0);
  });

  it('second run skips all', async () => {
    const store = new SqliteEventStore({ filename: ':memory:' });
    const seed: ValidatedSeed = { events: [envelope('Thing-1', 1)] };
    await applySeed(seed, store, { mode: 'upsertByEventId' });
    const r = await applySeed(seed, store, { mode: 'upsertByEventId' });
    expect(r.appliedCount).toBe(0);
    expect(r.skippedCount).toBe(1);
  });

  it('new events alongside old ones apply; existing skipped', async () => {
    const store = new SqliteEventStore({ filename: ':memory:' });
    await applySeed({ events: [envelope('Thing-1', 1)] }, store, { mode: 'upsertByEventId' });
    const r = await applySeed(
      { events: [envelope('Thing-1', 1), envelope('Thing-2', 1)] },
      store,
      { mode: 'upsertByEventId' },
    );
    expect(r.appliedCount).toBe(1);
    expect(r.skippedCount).toBe(1);
  });

  it('raises SEED_STREAM_VERSION_CONFLICT on (stream, version) with different eventId', async () => {
    const store = new SqliteEventStore({ filename: ':memory:' });
    await applySeed({ events: [envelope('Thing-1', 1, 'first')] }, store, { mode: 'upsertByEventId' });
    await expect(
      applySeed({ events: [envelope('Thing-1', 1, 'second')] }, store, { mode: 'upsertByEventId' }),
    ).rejects.toMatchObject({ code: 'SEED_STREAM_VERSION_CONFLICT' });
  });
});
