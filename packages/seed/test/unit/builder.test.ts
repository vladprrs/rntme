import { describe, expect, it } from 'vitest';
import { seedBuilder } from '../../src/builder.js';

describe('seedBuilder', () => {
  it('builds a minimal artifact', () => {
    const seed = seedBuilder()
      .event({
        stream: 'Thing-1',
        aggregateType: 'Thing',
        aggregateId: '1',
        version: 1,
        eventType: 'ThingCreated',
        payload: { name: 'x' },
        occurredAt: '2026-01-01T00:00:00.000Z',
      })
      .build();
    expect(seed.seedVersion).toBe(1);
    expect(seed.events).toHaveLength(1);
  });

  it('chains event calls', () => {
    const seed = seedBuilder()
      .event({
        stream: 'A',
        aggregateType: 'T',
        aggregateId: '1',
        version: 1,
        eventType: 'TCreated',
        payload: { n: 1 },
        occurredAt: '2026-01-01T00:00:00.000Z',
      })
      .event({
        stream: 'A',
        aggregateType: 'T',
        aggregateId: '1',
        version: 2,
        eventType: 'TUpdated',
        payload: { n: 2 },
        occurredAt: '2026-01-01T00:01:00.000Z',
      })
      .build();
    expect(seed.events).toHaveLength(2);
    const [e0, e1] = seed.events;
    expect(e0?.stream).toBe('A');
    expect(e0?.aggregateType).toBe('T');
    expect(e1?.version).toBe(2);
  });

  it('returns a frozen snapshot on build', () => {
    const b = seedBuilder().event({
      stream: 'Thing-1',
      aggregateType: 'Thing',
      aggregateId: '1',
      version: 1,
      eventType: 'ThingCreated',
      payload: { name: 'x' },
      occurredAt: '2026-01-01T00:00:00.000Z',
    });
    const first = b.build();
    b.event({
      stream: 'Thing-1',
      aggregateType: 'Thing',
      aggregateId: '1',
      version: 2,
      eventType: 'ThingRenamed',
      payload: { name: 'y' },
      occurredAt: '2026-01-01T00:01:00.000Z',
    });
    expect(first.events).toHaveLength(1);
  });
});
