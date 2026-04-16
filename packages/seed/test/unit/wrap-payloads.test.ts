import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePdm, validatePdm, createPdmResolver, deriveEventTypes } from '@rntme/pdm';
import type { EventEnvelope } from '@rntme/event-store';
import { wrapPayloads } from '../../src/wrap-payloads.js';

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

function envelope(
  overrides: Partial<EventEnvelope> & { stream: string; version: number; eventType: string; aggregateType: string; payload: Record<string, unknown> },
): EventEnvelope {
  return {
    eventId: `seed:${overrides.aggregateType}:${overrides.stream.split('-')[1]}:v${overrides.version}`,
    aggregateId: overrides.stream.split('-')[1]!,
    occurredAt: '2026-01-01T00:00:00.000Z',
    actor: { kind: 'system', id: 'seed' },
    schemaVersion: 1,
    ...overrides,
  };
}

describe('wrapPayloads', () => {
  it('wraps a creation event: before=null, after includes stateField', () => {
    const c = ctx();
    const envelopes = [
      envelope({
        stream: 'Thing-1', aggregateType: 'Thing', version: 1,
        eventType: 'ThingCreated', payload: { name: 'hello' },
      }),
    ];
    const wrapped = wrapPayloads(envelopes, c);
    const p = wrapped[0]!.payload as { before: unknown; after: Record<string, unknown> };
    expect(p.before).toBeNull();
    expect(p.after).toEqual({ name: 'hello', status: 'active' });
  });

  it('wraps a non-creation event: before has affected fields from accumulated state', () => {
    const c = ctx();
    const envelopes = [
      envelope({
        stream: 'Thing-1', aggregateType: 'Thing', version: 1,
        eventType: 'ThingCreated', payload: { name: 'hello' },
      }),
      envelope({
        stream: 'Thing-1', aggregateType: 'Thing', version: 2,
        eventType: 'ThingRenamed', payload: { name: 'world', status: 'active' },
      }),
    ];
    const wrapped = wrapPayloads(envelopes, c);
    const p1 = wrapped[0]!.payload as { before: unknown; after: Record<string, unknown> };
    expect(p1.before).toBeNull();
    expect(p1.after).toEqual({ name: 'hello', status: 'active' });

    const p2 = wrapped[1]!.payload as { before: Record<string, unknown>; after: Record<string, unknown> };
    expect(p2.before).toEqual({ status: 'active', name: 'hello' });
    expect(p2.after).toEqual({ name: 'world', status: 'active' });
  });

  it('wraps a terminal transition: before reflects accumulated state', () => {
    const c = ctx();
    const envelopes = [
      envelope({
        stream: 'Thing-1', aggregateType: 'Thing', version: 1,
        eventType: 'ThingCreated', payload: { name: 'hello' },
      }),
      envelope({
        stream: 'Thing-1', aggregateType: 'Thing', version: 2,
        eventType: 'ThingArchived', payload: { status: 'archived' },
      }),
    ];
    const wrapped = wrapPayloads(envelopes, c);
    const p2 = wrapped[1]!.payload as { before: Record<string, unknown>; after: Record<string, unknown> };
    expect(p2.before).toEqual({ status: 'active' });
    expect(p2.after).toEqual({ status: 'archived' });
  });

  it('handles multiple independent streams', () => {
    const c = ctx();
    const envelopes = [
      envelope({
        stream: 'Thing-1', aggregateType: 'Thing', version: 1,
        eventType: 'ThingCreated', payload: { name: 'a' },
      }),
      envelope({
        stream: 'Thing-2', aggregateType: 'Thing', version: 1,
        eventType: 'ThingCreated', payload: { name: 'b' },
      }),
    ];
    const wrapped = wrapPayloads(envelopes, c);
    const p1 = wrapped[0]!.payload as { before: unknown; after: Record<string, unknown> };
    const p2 = wrapped[1]!.payload as { before: unknown; after: Record<string, unknown> };
    expect(p1.after).toEqual({ name: 'a', status: 'active' });
    expect(p2.after).toEqual({ name: 'b', status: 'active' });
  });

  it('skips envelopes whose payload already has {before, after} shape', () => {
    const c = ctx();
    const alreadyWrapped = envelope({
      stream: 'Thing-1', aggregateType: 'Thing', version: 1,
      eventType: 'ThingCreated',
      payload: { before: null, after: { name: 'pre-wrapped', status: 'active' } } as unknown as Record<string, unknown>,
    });
    const wrapped = wrapPayloads([alreadyWrapped], c);
    expect(wrapped[0]!.payload).toEqual({ before: null, after: { name: 'pre-wrapped', status: 'active' } });
  });

  it('preserves envelope fields other than payload', () => {
    const c = ctx();
    const original = envelope({
      stream: 'Thing-1', aggregateType: 'Thing', version: 1,
      eventType: 'ThingCreated', payload: { name: 'x' },
      eventId: 'custom-id',
      actor: { kind: 'user', id: 'alice' },
    });
    const wrapped = wrapPayloads([original], c);
    expect(wrapped[0]!.eventId).toBe('custom-id');
    expect(wrapped[0]!.actor).toEqual({ kind: 'user', id: 'alice' });
    expect(wrapped[0]!.stream).toBe('Thing-1');
    expect(wrapped[0]!.version).toBe(1);
  });
});
