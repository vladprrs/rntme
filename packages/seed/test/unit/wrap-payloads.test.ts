import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePdm, validatePdm, createPdmResolver, deriveEventTypes } from '@rntme/pdm';
import type { EventEnvelope } from '@rntme/event-store';
import { wrapPayloads } from '../../src/wrap-payloads.js';

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

type EnvelopeOverrides = Partial<EventEnvelope> & {
  subject: string;
  rntVersion: number;
  eventType: string;
  rntAggregateType: string;
  data: Record<string, unknown>;
};

function envelope(o: EnvelopeOverrides): EventEnvelope {
  const aggregateId = o.subject.split('-')[1] ?? '0';
  const base: EventEnvelope = {
    id: `seed:${o.rntAggregateType}:${aggregateId}:v${o.rntVersion}`,
    source: `rntme://${SERVICE_NAME}/${o.rntAggregateType}`,
    eventType: o.eventType,
    type: `${SERVICE_NAME}.${o.rntAggregateType}.${o.eventType}`,
    time: '2026-01-01T00:00:00.000Z',
    subject: o.subject,
    dataContentType: 'application/json',
    dataSchema: `rntme://schemas/${SERVICE_NAME}/${o.eventType}.v1.json`,
    data: o.data,
    correlationId: 'seed:11111111-1111-1111-1111-111111111111',
    causationId: null,
    commandId: null,
    rntAggregateType: o.rntAggregateType,
    rntAggregateId: aggregateId,
    rntVersion: o.rntVersion,
    rntSchemaVersion: 1,
    rntActorKind: 'system',
    rntActorId: 'seed',
    traceparent: null,
  };
  return { ...base, ...o };
}

describe('wrapPayloads', () => {
  it('wraps a creation event: before=null, after includes stateField', () => {
    const c = ctx();
    const envelopes = [
      envelope({
        subject: 'Thing-1', rntAggregateType: 'Thing', rntVersion: 1,
        eventType: 'ThingCreated', data: { name: 'hello' },
      }),
    ];
    const wrapped = wrapPayloads(envelopes, c);
    const p = wrapped[0]!.data as { before: unknown; after: Record<string, unknown> };
    expect(p.before).toBeNull();
    expect(p.after).toEqual({ name: 'hello', status: 'active' });
  });

  it('wraps a non-creation event: before has affected fields from accumulated state', () => {
    const c = ctx();
    const envelopes = [
      envelope({
        subject: 'Thing-1', rntAggregateType: 'Thing', rntVersion: 1,
        eventType: 'ThingCreated', data: { name: 'hello' },
      }),
      envelope({
        subject: 'Thing-1', rntAggregateType: 'Thing', rntVersion: 2,
        eventType: 'ThingRenamed', data: { name: 'world', status: 'active' },
      }),
    ];
    const wrapped = wrapPayloads(envelopes, c);
    const p1 = wrapped[0]!.data as { before: unknown; after: Record<string, unknown> };
    expect(p1.before).toBeNull();
    expect(p1.after).toEqual({ name: 'hello', status: 'active' });

    const p2 = wrapped[1]!.data as { before: Record<string, unknown>; after: Record<string, unknown> };
    expect(p2.before).toEqual({ status: 'active', name: 'hello' });
    expect(p2.after).toEqual({ name: 'world', status: 'active' });
  });

  it('wraps a terminal transition: before reflects accumulated state', () => {
    const c = ctx();
    const envelopes = [
      envelope({
        subject: 'Thing-1', rntAggregateType: 'Thing', rntVersion: 1,
        eventType: 'ThingCreated', data: { name: 'hello' },
      }),
      envelope({
        subject: 'Thing-1', rntAggregateType: 'Thing', rntVersion: 2,
        eventType: 'ThingArchived', data: { status: 'archived' },
      }),
    ];
    const wrapped = wrapPayloads(envelopes, c);
    const p2 = wrapped[1]!.data as { before: Record<string, unknown>; after: Record<string, unknown> };
    expect(p2.before).toEqual({ status: 'active' });
    expect(p2.after).toEqual({ status: 'archived' });
  });

  it('handles multiple independent subjects', () => {
    const c = ctx();
    const envelopes = [
      envelope({
        subject: 'Thing-1', rntAggregateType: 'Thing', rntVersion: 1,
        eventType: 'ThingCreated', data: { name: 'a' },
      }),
      envelope({
        subject: 'Thing-2', rntAggregateType: 'Thing', rntVersion: 1,
        eventType: 'ThingCreated', data: { name: 'b' },
      }),
    ];
    const wrapped = wrapPayloads(envelopes, c);
    const p1 = wrapped[0]!.data as { before: unknown; after: Record<string, unknown> };
    const p2 = wrapped[1]!.data as { before: unknown; after: Record<string, unknown> };
    expect(p1.after).toEqual({ name: 'a', status: 'active' });
    expect(p2.after).toEqual({ name: 'b', status: 'active' });
  });

  it('skips envelopes whose data already has {before, after} shape', () => {
    const c = ctx();
    const alreadyWrapped = envelope({
      subject: 'Thing-1', rntAggregateType: 'Thing', rntVersion: 1,
      eventType: 'ThingCreated',
      data: { before: null, after: { name: 'pre-wrapped', status: 'active' } } as unknown as Record<string, unknown>,
    });
    const wrapped = wrapPayloads([alreadyWrapped], c);
    expect(wrapped[0]!.data).toEqual({ before: null, after: { name: 'pre-wrapped', status: 'active' } });
  });

  it('preserves envelope fields other than data', () => {
    const c = ctx();
    const original = envelope({
      subject: 'Thing-1', rntAggregateType: 'Thing', rntVersion: 1,
      eventType: 'ThingCreated', data: { name: 'x' },
      id: 'custom-id',
      rntActorKind: 'user',
      rntActorId: 'alice',
    });
    const wrapped = wrapPayloads([original], c);
    expect(wrapped[0]!.id).toBe('custom-id');
    expect(wrapped[0]!.rntActorKind).toBe('user');
    expect(wrapped[0]!.rntActorId).toBe('alice');
    expect(wrapped[0]!.subject).toBe('Thing-1');
    expect(wrapped[0]!.rntVersion).toBe(1);
  });
});
