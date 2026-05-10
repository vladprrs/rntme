import { describe, it, expect } from 'bun:test';
import { SqliteEventStore } from '@rntme/event-store';
import type { EventEnvelope } from '@rntme/event-store';
import { applySeed } from '../../src/apply.js';
import type { ValidatedSeed } from '../../src/types.js';

const SERVICE_NAME = 'test-service';

function envelope(overrides: Partial<EventEnvelope> = {}): EventEnvelope {
  const base: EventEnvelope = {
    id: 'seed:Thing:1:v1',
    source: `rntme://${SERVICE_NAME}/Thing`,
    eventType: 'ThingCreated',
    type: `${SERVICE_NAME}.Thing.ThingCreated`,
    time: '2026-01-01T00:00:00.000Z',
    subject: 'Thing-1',
    dataContentType: 'application/json',
    dataSchema: `rntme://schemas/${SERVICE_NAME}/ThingCreated.v1.json`,
    data: { name: 'x' },
    correlationId: 'seed:11111111-1111-1111-1111-111111111111',
    causationId: null,
    commandId: null,
    rntAggregateType: 'Thing',
    rntAggregateId: '1',
    rntVersion: 1,
    rntSchemaVersion: 1,
    rntActorKind: 'system',
    rntActorId: 'seed',
    traceparent: null,
  };
  return { ...base, ...overrides };
}

const seed: ValidatedSeed = { events: [envelope()] };

describe('applySeed — strict mode', () => {
  it('applies on an empty store', async () => {
    const store = new SqliteEventStore({ filename: ':memory:', serviceName: SERVICE_NAME });
    const result = await applySeed(seed, store, { serviceName: SERVICE_NAME });
    expect(result.appliedCount).toBe(1);
    expect(result.skippedCount).toBe(0);
    expect(store.readStream('Thing-1')).toHaveLength(1);
  });

  it('rejects SEED_STORE_NOT_EMPTY if log is non-empty', async () => {
    const store = new SqliteEventStore({ filename: ':memory:', serviceName: SERVICE_NAME });
    await applySeed(seed, store, { serviceName: SERVICE_NAME });
    await expect(
      applySeed(seed, store, { serviceName: SERVICE_NAME }),
    ).rejects.toMatchObject({ code: 'SEED_STORE_NOT_EMPTY' });
    expect(store.readStream('Thing-1')).toHaveLength(1);
  });

  it('rejects when opts.serviceName is missing', async () => {
    const store = new SqliteEventStore({ filename: ':memory:', serviceName: SERVICE_NAME });
    await expect(
      // @ts-expect-error intentional missing serviceName
      applySeed(seed, store, {}),
    ).rejects.toThrow(/serviceName is required/);
  });

  it('applied rows carry command_id=NULL and correlation_id starting with "seed:"', async () => {
    const store = new SqliteEventStore({ filename: ':memory:', serviceName: SERVICE_NAME });
    await applySeed(seed, store, { serviceName: SERVICE_NAME });
    const rows = store
      .rawDb()
      .prepare('SELECT command_id, correlation_id FROM event_log')
      .all() as Array<{ command_id: string | null; correlation_id: string }>;
    expect(rows).toHaveLength(1);
    expect(rows[0]!.command_id).toBeNull();
    expect(rows[0]!.correlation_id.startsWith('seed:')).toBe(true);
  });
});
