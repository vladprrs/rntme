import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePdm, validatePdm, createPdmResolver, deriveEventTypes } from '@rntme/pdm';
import { validateSeed } from '../../src/validate.js';
import type { SeedArtifact } from '../../src/types.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const SERVICE_NAME = 'test-service';

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
    serviceName: SERVICE_NAME,
  };
}
function seed(events: SeedArtifact['events']): SeedArtifact {
  return { seedVersion: 1, events };
}

describe('validateSeed — layer 3 (intra-file invariants)', () => {
  it('rejects SEED_STREAM_VERSION_GAP', () => {
    const result = validateSeed(
      seed([
        {
          id: 'a',
          subject: 'Thing-1', rntAggregateType: 'Thing', rntAggregateId: '1', rntVersion: 1,
          eventType: 'ThingCreated', data: { name: 'x' },
          time: '2026-01-01T00:00:00.000Z', rntSchemaVersion: 1,
        },
        {
          id: 'b',
          subject: 'Thing-1', rntAggregateType: 'Thing', rntAggregateId: '1', rntVersion: 3,
          eventType: 'ThingRenamed', data: { name: 'y', status: 'active' },
          time: '2026-01-02T00:00:00.000Z', rntSchemaVersion: 1,
        },
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
        {
          id: 'a',
          subject: 'Thing-1', rntAggregateType: 'Thing', rntAggregateId: '1', rntVersion: 1,
          eventType: 'ThingCreated', data: { name: 'x' },
          time: '2026-01-01T00:00:00.000Z', rntSchemaVersion: 1,
        },
        {
          id: 'b',
          subject: 'Thing-1', rntAggregateType: 'Thing', rntAggregateId: '1', rntVersion: 1,
          eventType: 'ThingCreated', data: { name: 'x' },
          time: '2026-01-01T00:00:01.000Z', rntSchemaVersion: 1,
        },
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
        {
          id: 'same',
          subject: 'Thing-1', rntAggregateType: 'Thing', rntAggregateId: '1', rntVersion: 1,
          eventType: 'ThingCreated', data: { name: 'x' },
          time: '2026-01-01T00:00:00.000Z', rntSchemaVersion: 1,
        },
        {
          id: 'same',
          subject: 'Thing-2', rntAggregateType: 'Thing', rntAggregateId: '2', rntVersion: 1,
          eventType: 'ThingCreated', data: { name: 'y' },
          time: '2026-01-01T00:00:01.000Z', rntSchemaVersion: 1,
        },
      ]),
      ctx(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.errors.some((e) => e.code === 'SEED_EVENT_ID_DUPLICATE')).toBe(true);
  });

  it('accepts multi-subject independent versions', () => {
    const result = validateSeed(
      seed([
        {
          id: 'a',
          subject: 'Thing-1', rntAggregateType: 'Thing', rntAggregateId: '1', rntVersion: 1,
          eventType: 'ThingCreated', data: { name: 'x' },
          time: '2026-01-01T00:00:00.000Z', rntSchemaVersion: 1,
        },
        {
          id: 'b',
          subject: 'Thing-2', rntAggregateType: 'Thing', rntAggregateId: '2', rntVersion: 1,
          eventType: 'ThingCreated', data: { name: 'y' },
          time: '2026-01-01T00:00:01.000Z', rntSchemaVersion: 1,
        },
        {
          id: 'c',
          subject: 'Thing-1', rntAggregateType: 'Thing', rntAggregateId: '1', rntVersion: 2,
          eventType: 'ThingRenamed', data: { name: 'x2', status: 'active' },
          time: '2026-01-02T00:00:00.000Z', rntSchemaVersion: 1,
        },
      ]),
      ctx(),
    );
    expect(result.ok).toBe(true);
  });
});
