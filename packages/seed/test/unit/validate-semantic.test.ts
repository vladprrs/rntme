import { describe, it, expect } from 'vitest';
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
  if (!parsed.ok) throw new Error('pdm fixture invalid');
  const validated = validatePdm(parsed.value);
  if (!validated.ok) throw new Error('pdm fixture invalid');
  return {
    pdm: createPdmResolver(validated.value),
    events: deriveEventTypes(validated.value),
    serviceName: SERVICE_NAME,
  };
}

function seed(events: SeedArtifact['events']): SeedArtifact {
  return { seedVersion: 1, events };
}

describe('validateSeed — layer 2 (semantic)', () => {
  it('accepts a valid single-event seed', () => {
    const result = validateSeed(
      seed([
        {
          id: 'seed:Thing:1:v1',
          subject: 'Thing-1',
          rntAggregateType: 'Thing',
          rntAggregateId: '1',
          rntVersion: 1,
          eventType: 'ThingCreated',
          data: { name: 'x' },
          time: '2026-01-01T00:00:00.000Z',
          rntSchemaVersion: 1,
        },
      ]),
      ctx(),
    );
    expect(result.ok).toBe(true);
  });

  it('derives CE source/type/dataSchema from serviceName and defaults optionals', () => {
    const result = validateSeed(
      seed([
        {
          id: 'seed:Thing:1:v1',
          subject: 'Thing-1',
          rntAggregateType: 'Thing',
          rntAggregateId: '1',
          rntVersion: 1,
          eventType: 'ThingCreated',
          data: { name: 'x' },
          time: '2026-01-01T00:00:00.000Z',
          rntSchemaVersion: 1,
        },
      ]),
      ctx(),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const e = result.value.events[0]!;
      expect(e.id).toBe('seed:Thing:1:v1');
      expect(e.source).toBe(`rntme://${SERVICE_NAME}/Thing`);
      expect(e.type).toBe(`${SERVICE_NAME}.Thing.ThingCreated`);
      expect(e.dataSchema).toBe(`rntme://schemas/${SERVICE_NAME}/ThingCreated.v1.json`);
      expect(e.dataContentType).toBe('application/json');
      expect(e.rntActorKind).toBe('system');
      expect(e.rntActorId).toBe('seed');
      expect(e.rntSchemaVersion).toBe(1);
      expect(e.causationId).toBeNull();
      expect(e.commandId).toBeNull();
      expect(e.traceparent).toBeNull();
      expect(e.correlationId.startsWith('seed:')).toBe(true);
    }
  });

  it('stamps one stable correlationId across the whole artifact when omitted', () => {
    const result = validateSeed(
      seed([
        {
          id: 'seed:Thing:1:v1',
          subject: 'Thing-1',
          rntAggregateType: 'Thing',
          rntAggregateId: '1',
          rntVersion: 1,
          eventType: 'ThingCreated',
          data: { name: 'x' },
          time: '2026-01-01T00:00:00.000Z',
          rntSchemaVersion: 1,
        },
        {
          id: 'seed:Thing:1:v2',
          subject: 'Thing-1',
          rntAggregateType: 'Thing',
          rntAggregateId: '1',
          rntVersion: 2,
          eventType: 'ThingRenamed',
          data: { name: 'y', status: 'active' },
          time: '2026-01-02T00:00:00.000Z',
          rntSchemaVersion: 1,
        },
      ]),
      ctx(),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const [a, b] = result.value.events;
      expect(a!.correlationId).toBe(b!.correlationId);
      expect(a!.correlationId.startsWith('seed:')).toBe(true);
    }
  });

  it('honours an explicit correlationId when provided', () => {
    const result = validateSeed(
      seed([
        {
          id: 'seed:Thing:1:v1',
          subject: 'Thing-1',
          rntAggregateType: 'Thing',
          rntAggregateId: '1',
          rntVersion: 1,
          eventType: 'ThingCreated',
          data: { name: 'x' },
          time: '2026-01-01T00:00:00.000Z',
          rntSchemaVersion: 1,
          correlationId: 'explicit-corr-id',
        },
      ]),
      ctx(),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.events[0]!.correlationId).toBe('explicit-corr-id');
    }
  });

  it('rejects SEED_UNKNOWN_AGGREGATE_TYPE', () => {
    const result = validateSeed(
      seed([
        {
          id: 'x',
          subject: 'Widget-1',
          rntAggregateType: 'Widget',
          rntAggregateId: '1',
          rntVersion: 1,
          eventType: 'WidgetCreated',
          data: {},
          time: '2026-01-01T00:00:00.000Z',
          rntSchemaVersion: 1,
        },
      ]),
      ctx(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.errors[0]!.code).toBe('SEED_UNKNOWN_AGGREGATE_TYPE');
  });

  it('rejects SEED_UNKNOWN_EVENT_TYPE', () => {
    const result = validateSeed(
      seed([
        {
          id: 'x',
          subject: 'Thing-1',
          rntAggregateType: 'Thing',
          rntAggregateId: '1',
          rntVersion: 1,
          eventType: 'ThingMangled',
          data: {},
          time: '2026-01-01T00:00:00.000Z',
          rntSchemaVersion: 1,
        },
      ]),
      ctx(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]!.code).toBe('SEED_UNKNOWN_EVENT_TYPE');
  });

  it('rejects SEED_EVENT_PAYLOAD_MISMATCH (missing required)', () => {
    const result = validateSeed(
      seed([
        {
          id: 'x',
          subject: 'Thing-1',
          rntAggregateType: 'Thing',
          rntAggregateId: '1',
          rntVersion: 1,
          eventType: 'ThingCreated',
          data: {}, // missing "name"
          time: '2026-01-01T00:00:00.000Z',
          rntSchemaVersion: 1,
        },
      ]),
      ctx(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]!.code).toBe('SEED_EVENT_PAYLOAD_MISMATCH');
  });

  it('rejects SEED_EVENT_PAYLOAD_MISMATCH (extra key)', () => {
    const result = validateSeed(
      seed([
        {
          id: 'x',
          subject: 'Thing-1',
          rntAggregateType: 'Thing',
          rntAggregateId: '1',
          rntVersion: 1,
          eventType: 'ThingCreated',
          data: { name: 'x', extra: true },
          time: '2026-01-01T00:00:00.000Z',
          rntSchemaVersion: 1,
        },
      ]),
      ctx(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]!.code).toBe('SEED_EVENT_PAYLOAD_MISMATCH');
  });

  it('rejects SEED_FIRST_EVENT_NOT_CREATION (archived before created)', () => {
    const result = validateSeed(
      seed([
        {
          id: 'x',
          subject: 'Thing-1',
          rntAggregateType: 'Thing',
          rntAggregateId: '1',
          rntVersion: 1,
          eventType: 'ThingArchived',
          data: { status: 'archived' },
          time: '2026-01-01T00:00:00.000Z',
          rntSchemaVersion: 1,
        },
      ]),
      ctx(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const codes = result.errors.map((e) => e.code);
      expect(codes).toContain('SEED_FIRST_EVENT_NOT_CREATION');
    }
  });

  it('rejects SEED_STATE_MACHINE_VIOLATION mid-stream', () => {
    const result = validateSeed(
      seed([
        {
          id: 'a',
          subject: 'Thing-1',
          rntAggregateType: 'Thing',
          rntAggregateId: '1',
          rntVersion: 1,
          eventType: 'ThingCreated',
          data: { name: 'x' },
          time: '2026-01-01T00:00:00.000Z',
          rntSchemaVersion: 1,
        },
        {
          id: 'b',
          subject: 'Thing-1',
          rntAggregateType: 'Thing',
          rntAggregateId: '1',
          rntVersion: 2,
          eventType: 'ThingArchived',
          data: { status: 'archived' },
          time: '2026-01-02T00:00:00.000Z',
          rntSchemaVersion: 1,
        },
        {
          id: 'c',
          subject: 'Thing-1',
          rntAggregateType: 'Thing',
          rntAggregateId: '1',
          rntVersion: 3,
          eventType: 'ThingRenamed',
          data: { name: 'y', status: 'active' },
          time: '2026-01-03T00:00:00.000Z',
          rntSchemaVersion: 1,
        },
      ]),
      ctx(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.errors.some((e) => e.code === 'SEED_STATE_MACHINE_VIOLATION')).toBe(true);
  });

  it('rejects SEED_ACTOR_REQUIRED for user actor with empty id', () => {
    const result = validateSeed(
      seed([
        {
          id: 'x',
          subject: 'Thing-1',
          rntAggregateType: 'Thing',
          rntAggregateId: '1',
          rntVersion: 1,
          eventType: 'ThingCreated',
          data: { name: 'x' },
          time: '2026-01-01T00:00:00.000Z',
          rntSchemaVersion: 1,
          rntActorKind: 'user',
          rntActorId: '',
        },
      ]),
      ctx(),
    );
    expect(result.ok).toBe(false);
  });

  it('normalizes flat data payloads to {before, after} in validated output', () => {
    const result = validateSeed(
      seed([
        {
          id: 'a',
          subject: 'Thing-1',
          rntAggregateType: 'Thing',
          rntAggregateId: '1',
          rntVersion: 1,
          eventType: 'ThingCreated',
          data: { name: 'x' },
          time: '2026-01-01T00:00:00.000Z',
          rntSchemaVersion: 1,
        },
        {
          id: 'b',
          subject: 'Thing-1',
          rntAggregateType: 'Thing',
          rntAggregateId: '1',
          rntVersion: 2,
          eventType: 'ThingRenamed',
          data: { name: 'y', status: 'active' },
          time: '2026-01-02T00:00:00.000Z',
          rntSchemaVersion: 1,
        },
      ]),
      ctx(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const e1 = result.value.events[0]!;
    const p1 = e1.data as { before: unknown; after: Record<string, unknown> };
    expect(p1.before).toBeNull();
    expect(p1.after).toEqual({ name: 'x', status: 'active' });

    const e2 = result.value.events[1]!;
    const p2 = e2.data as { before: Record<string, unknown>; after: Record<string, unknown> };
    expect(p2.before).toEqual({ status: 'active', name: 'x' });
    expect(p2.after).toEqual({ name: 'y', status: 'active' });
  });
});
