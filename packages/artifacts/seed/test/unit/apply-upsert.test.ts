import { describe, it, expect } from 'bun:test';
import { SqliteEventStore } from '@rntme/event-store';
import type { EventEnvelope } from '@rntme/event-store';
import { applySeed } from '../../src/apply.js';
import type { ValidatedSeed } from '../../src/types.js';

const SERVICE_NAME = 'test-service';

function envelope(subject: string, version: number, id?: string): EventEnvelope {
  const aggregateId = subject.split('-')[1] ?? '0';
  return {
    id: id ?? `seed:${subject}:v${version}`,
    source: `rntme://${SERVICE_NAME}/Thing`,
    eventType: 'ThingCreated',
    type: `${SERVICE_NAME}.Thing.ThingCreated`,
    time: '2026-01-01T00:00:00.000Z',
    subject,
    dataContentType: 'application/json',
    dataSchema: `rntme://schemas/${SERVICE_NAME}/ThingCreated.v1.json`,
    data: { name: 'x' },
    correlationId: 'seed:11111111-1111-1111-1111-111111111111',
    causationId: null,
    commandId: null,
    rntAggregateType: 'Thing',
    rntAggregateId: aggregateId,
    rntVersion: version,
    rntSchemaVersion: 1,
    rntActorKind: 'system',
    rntActorId: 'seed',
    traceparent: null,
  };
}

describe('applySeed — upsertByEventId mode', () => {
  it('first run applies all', async () => {
    const store = new SqliteEventStore({ filename: ':memory:', serviceName: SERVICE_NAME });
    const seed: ValidatedSeed = { events: [envelope('Thing-1', 1), envelope('Thing-2', 1)] };
    const r = await applySeed(seed, store, {
      mode: 'upsertByEventId',
      serviceName: SERVICE_NAME,
    });
    expect(r.appliedCount).toBe(2);
    expect(r.skippedCount).toBe(0);
  });

  it('second run skips all', async () => {
    const store = new SqliteEventStore({ filename: ':memory:', serviceName: SERVICE_NAME });
    const seed: ValidatedSeed = { events: [envelope('Thing-1', 1)] };
    await applySeed(seed, store, { mode: 'upsertByEventId', serviceName: SERVICE_NAME });
    const r = await applySeed(seed, store, {
      mode: 'upsertByEventId',
      serviceName: SERVICE_NAME,
    });
    expect(r.appliedCount).toBe(0);
    expect(r.skippedCount).toBe(1);
  });

  it('new events alongside old ones apply; existing skipped', async () => {
    const store = new SqliteEventStore({ filename: ':memory:', serviceName: SERVICE_NAME });
    await applySeed({ events: [envelope('Thing-1', 1)] }, store, {
      mode: 'upsertByEventId',
      serviceName: SERVICE_NAME,
    });
    const r = await applySeed(
      { events: [envelope('Thing-1', 1), envelope('Thing-2', 1)] },
      store,
      { mode: 'upsertByEventId', serviceName: SERVICE_NAME },
    );
    expect(r.appliedCount).toBe(1);
    expect(r.skippedCount).toBe(1);
  });

  it('raises SEED_STREAM_VERSION_CONFLICT on (subject, rntVersion) with different id', async () => {
    const store = new SqliteEventStore({ filename: ':memory:', serviceName: SERVICE_NAME });
    await applySeed({ events: [envelope('Thing-1', 1, 'first')] }, store, {
      mode: 'upsertByEventId',
      serviceName: SERVICE_NAME,
    });
    await expect(
      applySeed({ events: [envelope('Thing-1', 1, 'second')] }, store, {
        mode: 'upsertByEventId',
        serviceName: SERVICE_NAME,
      }),
    ).rejects.toMatchObject({ code: 'SEED_STREAM_VERSION_CONFLICT' });
  });
});
