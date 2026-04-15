import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parsePdm, validatePdm, createPdmResolver, deriveEventTypes } from '@rntme/pdm';
import { validateSeed } from '../../src/validate.js';
import type { SeedArtifact } from '../../src/types.js';

const pdmRaw = JSON.parse(
  readFileSync(resolve(__dirname, '../fixtures/minimal-pdm.json'), 'utf8'),
);

function ctx() {
  const parsed = parsePdm(pdmRaw);
  if (!parsed.ok) throw new Error();
  const validated = validatePdm(parsed.value);
  if (!validated.ok) throw new Error();
  return {
    pdm: createPdmResolver(validated.value),
    events: deriveEventTypes(validated.value),
  };
}
function seed(events: SeedArtifact['events']): SeedArtifact {
  return { seedVersion: 1, events };
}

describe('validateSeed — layer 3 (intra-file invariants)', () => {
  it('rejects SEED_STREAM_VERSION_GAP', () => {
    const result = validateSeed(
      seed([
        { stream: 'Thing-1', aggregateType: 'Thing', aggregateId: '1', version: 1,
          eventType: 'ThingCreated', payload: { name: 'x', status: 'active' },
          occurredAt: '2026-01-01T00:00:00.000Z' },
        { stream: 'Thing-1', aggregateType: 'Thing', aggregateId: '1', version: 3,
          eventType: 'ThingRenamed', payload: { name: 'y' },
          occurredAt: '2026-01-02T00:00:00.000Z' },
      ]),
      ctx(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.errors.some((e) => e.code === 'SEED_STREAM_VERSION_GAP')).toBe(true);
  });

  it('rejects SEED_STREAM_VERSION_DUPLICATE', () => {
    const result = validateSeed(
      seed([
        { stream: 'Thing-1', aggregateType: 'Thing', aggregateId: '1', version: 1,
          eventType: 'ThingCreated', payload: { name: 'x', status: 'active' },
          occurredAt: '2026-01-01T00:00:00.000Z' },
        { stream: 'Thing-1', aggregateType: 'Thing', aggregateId: '1', version: 1,
          eventType: 'ThingCreated', payload: { name: 'x', status: 'active' },
          occurredAt: '2026-01-01T00:00:01.000Z' },
      ]),
      ctx(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'SEED_STREAM_VERSION_DUPLICATE')).toBe(true);
      expect(result.errors.some((e) => e.code === 'SEED_STREAM_VERSION_GAP')).toBe(false);
    }
  });

  it('rejects SEED_EVENT_ID_DUPLICATE', () => {
    const result = validateSeed(
      seed([
        { stream: 'Thing-1', aggregateType: 'Thing', aggregateId: '1', version: 1,
          eventType: 'ThingCreated', payload: { name: 'x', status: 'active' },
          occurredAt: '2026-01-01T00:00:00.000Z', eventId: 'same' },
        { stream: 'Thing-2', aggregateType: 'Thing', aggregateId: '2', version: 1,
          eventType: 'ThingCreated', payload: { name: 'y', status: 'active' },
          occurredAt: '2026-01-01T00:00:01.000Z', eventId: 'same' },
      ]),
      ctx(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.errors.some((e) => e.code === 'SEED_EVENT_ID_DUPLICATE')).toBe(true);
  });

  it('accepts multi-stream independent versions', () => {
    const result = validateSeed(
      seed([
        { stream: 'Thing-1', aggregateType: 'Thing', aggregateId: '1', version: 1,
          eventType: 'ThingCreated', payload: { name: 'x', status: 'active' },
          occurredAt: '2026-01-01T00:00:00.000Z' },
        { stream: 'Thing-2', aggregateType: 'Thing', aggregateId: '2', version: 1,
          eventType: 'ThingCreated', payload: { name: 'y', status: 'active' },
          occurredAt: '2026-01-01T00:00:01.000Z' },
        { stream: 'Thing-1', aggregateType: 'Thing', aggregateId: '1', version: 2,
          eventType: 'ThingRenamed', payload: { name: 'x2', status: 'active' },
          occurredAt: '2026-01-02T00:00:00.000Z' },
      ]),
      ctx(),
    );
    expect(result.ok).toBe(true);
  });
});
