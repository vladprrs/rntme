import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePdm, validatePdm, createPdmResolver, deriveEventTypes } from '@rntme/pdm';
import { validateSeed } from '../../src/validate.js';
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

function seed(events: SeedArtifact['events']): SeedArtifact {
  return { seedVersion: 1, events };
}

describe('validateSeed — layer 2 (semantic)', () => {
  it('accepts a valid single-event seed', () => {
    const result = validateSeed(
      seed([
        {
          stream: 'Thing-1',
          aggregateType: 'Thing',
          aggregateId: '1',
          version: 1,
          eventType: 'ThingCreated',
          payload: { name: 'x' },
          occurredAt: '2026-01-01T00:00:00.000Z',
        },
      ]),
      ctx(),
    );
    expect(result.ok).toBe(true);
  });

  it('defaults eventId, actor, schemaVersion', () => {
    const result = validateSeed(
      seed([
        {
          stream: 'Thing-1',
          aggregateType: 'Thing',
          aggregateId: '1',
          version: 1,
          eventType: 'ThingCreated',
          payload: { name: 'x' },
          occurredAt: '2026-01-01T00:00:00.000Z',
        },
      ]),
      ctx(),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const e = result.value.events[0]!;
      expect(e.eventId).toBe('seed:Thing:1:v1');
      expect(e.actor).toEqual({ kind: 'system', id: 'seed' });
      expect(e.schemaVersion).toBe(1);
    }
  });

  it('rejects SEED_UNKNOWN_AGGREGATE_TYPE', () => {
    const result = validateSeed(
      seed([
        {
          stream: 'Widget-1',
          aggregateType: 'Widget',
          aggregateId: '1',
          version: 1,
          eventType: 'WidgetCreated',
          payload: {},
          occurredAt: '2026-01-01T00:00:00.000Z',
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
          stream: 'Thing-1',
          aggregateType: 'Thing',
          aggregateId: '1',
          version: 1,
          eventType: 'ThingMangled',
          payload: {},
          occurredAt: '2026-01-01T00:00:00.000Z',
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
          stream: 'Thing-1',
          aggregateType: 'Thing',
          aggregateId: '1',
          version: 1,
          eventType: 'ThingCreated',
          payload: {}, // missing "name"
          occurredAt: '2026-01-01T00:00:00.000Z',
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
          stream: 'Thing-1',
          aggregateType: 'Thing',
          aggregateId: '1',
          version: 1,
          eventType: 'ThingCreated',
          payload: { name: 'x', extra: true },
          occurredAt: '2026-01-01T00:00:00.000Z',
        },
      ]),
      ctx(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]!.code).toBe('SEED_EVENT_PAYLOAD_MISMATCH');
  });

  it('rejects SEED_STATE_MACHINE_VIOLATION (archived before created)', () => {
    const result = validateSeed(
      seed([
        {
          stream: 'Thing-1',
          aggregateType: 'Thing',
          aggregateId: '1',
          version: 1,
          eventType: 'ThingArchived',
          payload: { status: 'archived' },
          occurredAt: '2026-01-01T00:00:00.000Z',
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
          stream: 'Thing-1',
          aggregateType: 'Thing',
          aggregateId: '1',
          version: 1,
          eventType: 'ThingCreated',
          payload: { name: 'x' },
          occurredAt: '2026-01-01T00:00:00.000Z',
        },
        {
          stream: 'Thing-1',
          aggregateType: 'Thing',
          aggregateId: '1',
          version: 2,
          eventType: 'ThingArchived',
          payload: { status: 'archived' },
          occurredAt: '2026-01-02T00:00:00.000Z',
        },
        {
          stream: 'Thing-1',
          aggregateType: 'Thing',
          aggregateId: '1',
          version: 3,
          eventType: 'ThingRenamed',
          payload: { name: 'y', status: 'active' },
          occurredAt: '2026-01-03T00:00:00.000Z',
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
          stream: 'Thing-1',
          aggregateType: 'Thing',
          aggregateId: '1',
          version: 1,
          eventType: 'ThingCreated',
          payload: { name: 'x' },
          occurredAt: '2026-01-01T00:00:00.000Z',
          actor: { kind: 'user', id: '' },
        },
      ]),
      ctx(),
    );
    expect(result.ok).toBe(false);
  });

  it('normalizes flat payloads to {before, after} in validated output', () => {
    const result = validateSeed(
      seed([
        {
          stream: 'Thing-1',
          aggregateType: 'Thing',
          aggregateId: '1',
          version: 1,
          eventType: 'ThingCreated',
          payload: { name: 'x' },
          occurredAt: '2026-01-01T00:00:00.000Z',
        },
        {
          stream: 'Thing-1',
          aggregateType: 'Thing',
          aggregateId: '1',
          version: 2,
          eventType: 'ThingRenamed',
          payload: { name: 'y', status: 'active' },
          occurredAt: '2026-01-02T00:00:00.000Z',
        },
      ]),
      ctx(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const e1 = result.value.events[0]!;
    const p1 = e1.payload as { before: unknown; after: Record<string, unknown> };
    expect(p1.before).toBeNull();
    expect(p1.after).toEqual({ name: 'x', status: 'active' });

    const e2 = result.value.events[1]!;
    const p2 = e2.payload as { before: Record<string, unknown>; after: Record<string, unknown> };
    expect(p2.before).toEqual({ status: 'active', name: 'x' });
    expect(p2.after).toEqual({ name: 'y', status: 'active' });
  });
});
