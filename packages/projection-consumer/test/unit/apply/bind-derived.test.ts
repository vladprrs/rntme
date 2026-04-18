import { describe, it, expect } from 'vitest';
import type { DerivedColumnBinding } from '@rntme/graph-ir-compiler';
import { bindDerivedValue } from '../../../src/apply/bind.js';
import { makeEnvelope } from '../../fixtures/envelopes.js';

describe('bindDerivedValue (D5 Task 19)', () => {
  it('aggregateId with sqlType INTEGER coerces to number', () => {
    const env = makeEnvelope({ aggregateId: '42' });
    const b: DerivedColumnBinding = { kind: 'aggregateId', sqlType: 'INTEGER' };
    expect(bindDerivedValue(b, env)).toBe(42);
  });

  it('aggregateId with sqlType TEXT returns the raw string', () => {
    const env = makeEnvelope({ aggregateId: 'abc-1' });
    const b: DerivedColumnBinding = { kind: 'aggregateId', sqlType: 'TEXT' };
    expect(bindDerivedValue(b, env)).toBe('abc-1');
  });

  it('payloadField pulls from payload.after; missing field binds to null', () => {
    const env = makeEnvelope({
      payload: { before: null, after: { status: 'draft', title: 'Hi' } },
    });
    const status: DerivedColumnBinding = { kind: 'payloadField', fieldName: 'status', sqlType: 'TEXT' };
    const missing: DerivedColumnBinding = { kind: 'payloadField', fieldName: 'nope', sqlType: 'TEXT' };
    expect(bindDerivedValue(status, env)).toBe('draft');
    expect(bindDerivedValue(missing, env)).toBeNull();
  });

  it('eventOccurredAt binds to envelope.occurredAt', () => {
    const env = makeEnvelope({ occurredAt: '2030-01-01T00:00:00.000Z' });
    expect(bindDerivedValue({ kind: 'eventOccurredAt' }, env)).toBe('2030-01-01T00:00:00.000Z');
  });

  it('eventActorId falls back to null when actor is null', () => {
    const env = makeEnvelope({ actor: null });
    expect(bindDerivedValue({ kind: 'eventActorId' }, env)).toBeNull();
  });

  it('eventActorId returns actor.id when present', () => {
    const env = makeEnvelope({ actor: { kind: 'user', id: 'u-7' } });
    expect(bindDerivedValue({ kind: 'eventActorId' }, env)).toBe('u-7');
  });

  it('eventId binds to envelope.eventId', () => {
    const env = makeEnvelope({ eventId: 'ev-xyz' });
    expect(bindDerivedValue({ kind: 'eventId' }, env)).toBe('ev-xyz');
  });

  it('appliedAt returns a fresh ISO timestamp string', () => {
    const env = makeEnvelope({});
    const v = bindDerivedValue({ kind: 'appliedAt' }, env);
    expect(typeof v).toBe('string');
    expect(() => new Date(v as string).toISOString()).not.toThrow();
  });

  it('literal bindings throw — they are embedded in SQL, not bound at runtime', () => {
    const env = makeEnvelope({});
    expect(() => bindDerivedValue({ kind: 'literal', sql: "'x'" }, env)).toThrow();
  });

  it('exprScalar bindings throw — they are decomposed at compile time', () => {
    const env = makeEnvelope({});
    expect(() =>
      bindDerivedValue(
        { kind: 'exprScalar', sql: 'coalesce(?, 0)', bindings: [{ kind: 'eventId' }] },
        env,
      ),
    ).toThrow();
  });
});
