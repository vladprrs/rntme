import { describe, expect, it } from 'bun:test';
import { seedBuilder } from '../../src/builder.js';

describe('seedBuilder', () => {
  it('builds a minimal artifact', () => {
    const seed = seedBuilder()
      .event({
        id: 'seed:Thing:1:v1',
        subject: 'Thing-1',
        rntAggregateType: 'Thing',
        rntAggregateId: '1',
        rntVersion: 1,
        eventType: 'ThingCreated',
        data: { name: 'x' },
        time: '2026-01-01T00:00:00.000Z',
        rntSchemaVersion: 1,
      })
      .build();
    expect(seed.seedVersion).toBe(1);
    expect(seed.events).toHaveLength(1);
  });

  it('chains event calls', () => {
    const seed = seedBuilder()
      .event({
        id: 'a',
        subject: 'A',
        rntAggregateType: 'T',
        rntAggregateId: '1',
        rntVersion: 1,
        eventType: 'TCreated',
        data: { n: 1 },
        time: '2026-01-01T00:00:00.000Z',
        rntSchemaVersion: 1,
      })
      .event({
        id: 'b',
        subject: 'A',
        rntAggregateType: 'T',
        rntAggregateId: '1',
        rntVersion: 2,
        eventType: 'TUpdated',
        data: { n: 2 },
        time: '2026-01-01T00:01:00.000Z',
        rntSchemaVersion: 1,
      })
      .build();
    expect(seed.events).toHaveLength(2);
    const [e0, e1] = seed.events;
    expect(e0?.subject).toBe('A');
    expect(e0?.rntAggregateType).toBe('T');
    expect(e1?.rntVersion).toBe(2);
  });

  it('returns a frozen snapshot on build', () => {
    const b = seedBuilder().event({
      id: 'a',
      subject: 'Thing-1',
      rntAggregateType: 'Thing',
      rntAggregateId: '1',
      rntVersion: 1,
      eventType: 'ThingCreated',
      data: { name: 'x' },
      time: '2026-01-01T00:00:00.000Z',
      rntSchemaVersion: 1,
    });
    const first = b.build();
    b.event({
      id: 'b',
      subject: 'Thing-1',
      rntAggregateType: 'Thing',
      rntAggregateId: '1',
      rntVersion: 2,
      eventType: 'ThingRenamed',
      data: { name: 'y' },
      time: '2026-01-01T00:01:00.000Z',
      rntSchemaVersion: 1,
    });
    expect(first.events).toHaveLength(1);
  });

  it('stamps the same seed:<uuid> correlationId on every event where omitted', () => {
    const seed = seedBuilder()
      .event({
        id: 'a',
        subject: 'Thing-1',
        rntAggregateType: 'Thing',
        rntAggregateId: '1',
        rntVersion: 1,
        eventType: 'ThingCreated',
        data: { name: 'x' },
        time: '2026-01-01T00:00:00.000Z',
        rntSchemaVersion: 1,
      })
      .event({
        id: 'b',
        subject: 'Thing-1',
        rntAggregateType: 'Thing',
        rntAggregateId: '1',
        rntVersion: 2,
        eventType: 'ThingRenamed',
        data: { name: 'y' },
        time: '2026-01-01T00:01:00.000Z',
        rntSchemaVersion: 1,
      })
      .build();
    const [e0, e1] = seed.events;
    expect(e0?.correlationId).toBeDefined();
    expect(e0?.correlationId).toMatch(/^seed:/);
    expect(e1?.correlationId).toBe(e0?.correlationId);
  });

  it('preserves an explicit correlationId', () => {
    const seed = seedBuilder()
      .event({
        id: 'a',
        subject: 'Thing-1',
        rntAggregateType: 'Thing',
        rntAggregateId: '1',
        rntVersion: 1,
        eventType: 'ThingCreated',
        data: { name: 'x' },
        time: '2026-01-01T00:00:00.000Z',
        rntSchemaVersion: 1,
        correlationId: 'explicit-corr-id',
      })
      .build();
    expect(seed.events[0]?.correlationId).toBe('explicit-corr-id');
  });

  it('mints distinct correlationIds across independent builders', () => {
    const build = (): string | undefined =>
      seedBuilder()
        .event({
          id: 'x',
          subject: 'Thing-1',
          rntAggregateType: 'Thing',
          rntAggregateId: '1',
          rntVersion: 1,
          eventType: 'ThingCreated',
          data: { name: 'x' },
          time: '2026-01-01T00:00:00.000Z',
          rntSchemaVersion: 1,
        })
        .build().events[0]?.correlationId;
    expect(build()).not.toBe(build());
  });
});
