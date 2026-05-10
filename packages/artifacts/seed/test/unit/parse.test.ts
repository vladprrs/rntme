import { describe, it, expect } from 'bun:test';
import { parseSeed } from '../../src/parse.js';

describe('parseSeed', () => {
  it('accepts a minimal valid artifact', () => {
    const raw = {
      seedVersion: 1,
      events: [
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
      ],
    };
    const result = parseSeed(raw);
    expect(result.ok).toBe(true);
  });

  it('rejects non-object input with SEED_SYNTAX_INVALID', () => {
    const result = parseSeed('not an object');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]!.code).toBe('SEED_SYNTAX_INVALID');
  });

  it('rejects missing seedVersion', () => {
    const result = parseSeed({ events: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'SEED_SYNTAX_INVALID')).toBe(true);
      expect(result.errors.some((e) => e.path?.includes('seedVersion'))).toBe(true);
    }
  });

  it('rejects seedVersion other than 1', () => {
    const result = parseSeed({ seedVersion: 2, events: [] });
    expect(result.ok).toBe(false);
  });

  it('rejects event with wrong rntVersion type', () => {
    const result = parseSeed({
      seedVersion: 1,
      events: [
        {
          id: 'seed:Thing:1:v1',
          subject: 'Thing-1',
          rntAggregateType: 'Thing',
          rntAggregateId: '1',
          rntVersion: '1',
          eventType: 'ThingCreated',
          data: {},
          time: '2026-01-01T00:00:00.000Z',
          rntSchemaVersion: 1,
        },
      ],
    });
    expect(result.ok).toBe(false);
  });

  it('rejects extra keys on an event (SEED_SYNTAX_UNKNOWN_FIELD)', () => {
    const result = parseSeed({
      seedVersion: 1,
      events: [
        {
          id: 'seed:Thing:1:v1',
          subject: 'Thing-1',
          rntAggregateType: 'Thing',
          rntAggregateId: '1',
          rntVersion: 1,
          eventType: 'ThingCreated',
          data: {},
          time: '2026-01-01T00:00:00.000Z',
          rntSchemaVersion: 1,
          extraField: 'nope',
        },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.errors.some((e) => e.code === 'SEED_SYNTAX_UNKNOWN_FIELD')).toBe(true);
  });

  it('rejects derived CE fields (source/type/dataSchema) as unknown', () => {
    const result = parseSeed({
      seedVersion: 1,
      events: [
        {
          id: 'seed:Thing:1:v1',
          subject: 'Thing-1',
          rntAggregateType: 'Thing',
          rntAggregateId: '1',
          rntVersion: 1,
          eventType: 'ThingCreated',
          data: {},
          time: '2026-01-01T00:00:00.000Z',
          rntSchemaVersion: 1,
          source: 'rntme://svc/Thing',
          type: 'svc.Thing.ThingCreated',
          dataSchema: 'rntme://schemas/svc/ThingCreated.v1.json',
        },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.errors.some((e) => e.code === 'SEED_SYNTAX_UNKNOWN_FIELD')).toBe(true);
  });

  it('rejects legacy field names as unknown', () => {
    const result = parseSeed({
      seedVersion: 1,
      events: [
        {
          stream: 'Thing-1',
          aggregateType: 'Thing',
          aggregateId: '1',
          version: 1,
          eventType: 'ThingCreated',
          payload: {},
          occurredAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });
    expect(result.ok).toBe(false);
  });

  it('rejects malformed time', () => {
    const result = parseSeed({
      seedVersion: 1,
      events: [
        {
          id: 'seed:Thing:1:v1',
          subject: 'Thing-1',
          rntAggregateType: 'Thing',
          rntAggregateId: '1',
          rntVersion: 1,
          eventType: 'ThingCreated',
          data: {},
          time: 'not-a-date',
          rntSchemaVersion: 1,
        },
      ],
    });
    expect(result.ok).toBe(false);
  });

  it('accepts optional CE fields (actor kind/id, correlationId, causationId, commandId, traceparent)', () => {
    const result = parseSeed({
      seedVersion: 1,
      events: [
        {
          id: 'custom:1',
          subject: 'Thing-1',
          rntAggregateType: 'Thing',
          rntAggregateId: '1',
          rntVersion: 1,
          eventType: 'ThingCreated',
          data: {},
          time: '2026-01-01T00:00:00.000Z',
          rntSchemaVersion: 1,
          rntActorKind: 'user',
          rntActorId: 'alice',
          correlationId: 'seed:abc',
          causationId: null,
          commandId: null,
          traceparent: null,
        },
      ],
    });
    expect(result.ok).toBe(true);
  });

  it('rejects half-specified actor (kind present, id null)', () => {
    const result = parseSeed({
      seedVersion: 1,
      events: [
        {
          id: 'x',
          subject: 'Thing-1',
          rntAggregateType: 'Thing',
          rntAggregateId: '1',
          rntVersion: 1,
          eventType: 'ThingCreated',
          data: {},
          time: '2026-01-01T00:00:00.000Z',
          rntSchemaVersion: 1,
          rntActorKind: 'user',
          rntActorId: null,
        },
      ],
    });
    expect(result.ok).toBe(false);
  });

  it('rejects half-specified actor (id present, kind null)', () => {
    const result = parseSeed({
      seedVersion: 1,
      events: [
        {
          id: 'x',
          subject: 'Thing-1',
          rntAggregateType: 'Thing',
          rntAggregateId: '1',
          rntVersion: 1,
          eventType: 'ThingCreated',
          data: {},
          time: '2026-01-01T00:00:00.000Z',
          rntSchemaVersion: 1,
          rntActorKind: null,
          rntActorId: 'alice',
        },
      ],
    });
    expect(result.ok).toBe(false);
  });

  it('accepts both actor fields null (system/seed events)', () => {
    const result = parseSeed({
      seedVersion: 1,
      events: [
        {
          id: 'x',
          subject: 'Thing-1',
          rntAggregateType: 'Thing',
          rntAggregateId: '1',
          rntVersion: 1,
          eventType: 'ThingCreated',
          data: {},
          time: '2026-01-01T00:00:00.000Z',
          rntSchemaVersion: 1,
          rntActorKind: null,
          rntActorId: null,
        },
      ],
    });
    expect(result.ok).toBe(true);
  });
});
