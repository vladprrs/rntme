import { describe, it, expect } from 'vitest';
import { SqliteEventStore } from '@rntme/event-store';
import { applySeed } from '../../src/apply.js';
import type { ValidatedSeed } from '../../src/types.js';

const seed: ValidatedSeed = {
  events: [
    {
      eventId: 'seed:Thing:1:v1',
      eventType: 'ThingCreated',
      aggregateType: 'Thing',
      aggregateId: '1',
      stream: 'Thing-1',
      version: 1,
      occurredAt: '2026-01-01T00:00:00.000Z',
      actor: { kind: 'system', id: 'seed' },
      payload: { name: 'x' },
      schemaVersion: 1,
    },
  ],
};

describe('applySeed — strict mode', () => {
  it('applies on an empty store', async () => {
    const store = new SqliteEventStore({ filename: ':memory:' });
    const result = await applySeed(seed, store);
    expect(result.appliedCount).toBe(1);
    expect(result.skippedCount).toBe(0);
    expect(store.readStream('Thing-1')).toHaveLength(1);
  });

  it('rejects SEED_STORE_NOT_EMPTY if log is non-empty', async () => {
    const store = new SqliteEventStore({ filename: ':memory:' });
    await applySeed(seed, store);
    await expect(applySeed(seed, store)).rejects.toMatchObject({
      code: 'SEED_STORE_NOT_EMPTY',
    });
    expect(store.readStream('Thing-1')).toHaveLength(1);
  });
});
