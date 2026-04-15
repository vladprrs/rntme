import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SqliteEventStore } from '@rntme/event-store';
import type { EventEnvelope } from '@rntme/event-store';
import { parsePdm, validatePdm, createPdmResolver, deriveEventTypes } from '@rntme/pdm';
import { applySeed } from '../../src/apply.js';
import { loadSeed } from '../../src/load.js';
import type { SeedArtifact } from '../../src/types.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const pdmRaw = JSON.parse(
  readFileSync(resolve(__dirname, '../fixtures/minimal-pdm.json'), 'utf8'),
);

function ctx() {
  const parsed = parsePdm(pdmRaw);
  if (!parsed.ok) throw new Error('pdm fixture invalid');
  const validated = validatePdm(parsed.value);
  if (!validated.ok) throw new Error('pdm fixture invalid');
  return {
    pdm: createPdmResolver(validated.value),
    events: deriveEventTypes(validated.value),
  };
}

const minimalSeed: SeedArtifact = {
  seedVersion: 1,
  events: [
    {
      stream: 'Thing-1',
      aggregateType: 'Thing',
      aggregateId: '1',
      version: 1,
      eventType: 'ThingCreated',
      payload: { name: 'x', status: 'active' },
      occurredAt: '2026-01-01T00:00:00.000Z',
    },
  ],
};

describe('applySeed strict', () => {
  it('applies all events to an empty store and returns counts', async () => {
    const store = new SqliteEventStore({ filename: ':memory:' });
    const loaded = loadSeed(minimalSeed as unknown as Record<string, unknown>, ctx());
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;

    const result = await applySeed(loaded.value, store, 'strict');
    expect(result).toEqual({ appliedCount: 1, skippedCount: 0 });
    expect(store.readStream('Thing-1')).toHaveLength(1);
  });

  it('rejects when the store is not empty', async () => {
    const store = new SqliteEventStore({ filename: ':memory:' });
    const loaded = loadSeed(minimalSeed as unknown as Record<string, unknown>, ctx());
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;

    await applySeed(loaded.value, store, 'strict');
    const again = loadSeed(minimalSeed as unknown as Record<string, unknown>, ctx());
    expect(again.ok).toBe(true);
    if (!again.ok) return;

    await expect(applySeed(again.value, store, 'strict')).rejects.toMatchObject({
      code: 'SEED_STORE_NOT_EMPTY',
    });
  });

  it('maps append ConcurrencyConflict to SEED_STREAM_VERSION_CONFLICT', async () => {
    const store = new SqliteEventStore({ filename: ':memory:' });
    const a: EventEnvelope = {
      eventId: 'a',
      eventType: 'ThingCreated',
      aggregateType: 'Thing',
      aggregateId: '1',
      stream: 'Thing-1',
      version: 1,
      occurredAt: '2026-01-01T00:00:00.000Z',
      actor: { kind: 'system', id: 'seed' },
      payload: { name: 'x', status: 'active' },
      schemaVersion: 1,
    };
    const b: EventEnvelope = {
      ...a,
      eventId: 'b',
    };
    const validated = { events: [a, b] as const };

    await expect(applySeed(validated, store, 'strict')).rejects.toMatchObject({
      code: 'SEED_STREAM_VERSION_CONFLICT',
    });
  });
});
