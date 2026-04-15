import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SqliteEventStore } from '@rntme/event-store';
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

const twoEventSeed: SeedArtifact = {
  seedVersion: 1,
  events: [
    {
      stream: 'Thing-1',
      aggregateType: 'Thing',
      aggregateId: '1',
      version: 1,
      eventType: 'ThingCreated',
      payload: { name: 'a', status: 'active' },
      occurredAt: '2026-01-01T00:00:00.000Z',
      eventId: 'seed-e1',
    },
    {
      stream: 'Thing-1',
      aggregateType: 'Thing',
      aggregateId: '1',
      version: 2,
      eventType: 'ThingRenamed',
      payload: { name: 'b', status: 'active' },
      occurredAt: '2026-01-01T00:01:00.000Z',
      eventId: 'seed-e2',
    },
  ],
};

describe('applySeed upsertByEventId', () => {
  it('applies all events when none exist yet', async () => {
    const store = new SqliteEventStore({ filename: ':memory:' });
    const loaded = loadSeed(twoEventSeed as unknown as Record<string, unknown>, ctx());
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;

    const result = await applySeed(loaded.value, store, 'upsertByEventId');
    expect(result).toEqual({ appliedCount: 2, skippedCount: 0 });
    expect(store.readStream('Thing-1')).toHaveLength(2);
  });

  it('skips events already present by eventId on a second apply', async () => {
    const store = new SqliteEventStore({ filename: ':memory:' });
    const loaded = loadSeed(twoEventSeed as unknown as Record<string, unknown>, ctx());
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;

    await applySeed(loaded.value, store, 'upsertByEventId');
    const again = loadSeed(twoEventSeed as unknown as Record<string, unknown>, ctx());
    expect(again.ok).toBe(true);
    if (!again.ok) return;

    const result = await applySeed(again.value, store, 'upsertByEventId');
    expect(result).toEqual({ appliedCount: 0, skippedCount: 2 });
    expect(store.readStream('Thing-1')).toHaveLength(2);
  });

  it('counts only new eventIds as applied when mixing new and existing', async () => {
    const store = new SqliteEventStore({ filename: ':memory:' });
    const first = loadSeed(
      {
        seedVersion: 1,
        events: [twoEventSeed.events[0]!],
      } as unknown as Record<string, unknown>,
      ctx(),
    );
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    await applySeed(first.value, store, 'upsertByEventId');

    const mixed = loadSeed(twoEventSeed as unknown as Record<string, unknown>, ctx());
    expect(mixed.ok).toBe(true);
    if (!mixed.ok) return;

    const result = await applySeed(mixed.value, store, 'upsertByEventId');
    expect(result).toEqual({ appliedCount: 1, skippedCount: 1 });
    expect(store.readStream('Thing-1')).toHaveLength(2);
  });
});
