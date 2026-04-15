import { describe, it, expect } from 'vitest';
import { parseSeed } from '../../src/parse.js';

describe('parseSeed', () => {
  it('accepts a minimal valid artifact', () => {
    const raw = {
      seedVersion: 1,
      events: [
        {
          stream: 'Thing-1',
          aggregateType: 'Thing',
          aggregateId: '1',
          version: 1,
          eventType: 'ThingCreated',
          payload: { name: 'x' },
          occurredAt: '2026-01-01T00:00:00.000Z',
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

  it('rejects event with wrong version type', () => {
    const result = parseSeed({
      seedVersion: 1,
      events: [
        {
          stream: 'Thing-1',
          aggregateType: 'Thing',
          aggregateId: '1',
          version: '1',
          eventType: 'ThingCreated',
          payload: {},
          occurredAt: '2026-01-01T00:00:00.000Z',
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
          stream: 'Thing-1',
          aggregateType: 'Thing',
          aggregateId: '1',
          version: 1,
          eventType: 'ThingCreated',
          payload: {},
          occurredAt: '2026-01-01T00:00:00.000Z',
          extraField: 'nope',
        },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.errors.some((e) => e.code === 'SEED_SYNTAX_UNKNOWN_FIELD')).toBe(true);
  });

  it('rejects malformed occurredAt', () => {
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
          occurredAt: 'not-a-date',
        },
      ],
    });
    expect(result.ok).toBe(false);
  });

  it('accepts actor and schemaVersion when provided', () => {
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
          actor: { kind: 'user', id: 'alice' },
          schemaVersion: 1,
          eventId: 'custom:1',
        },
      ],
    });
    expect(result.ok).toBe(true);
  });
});
