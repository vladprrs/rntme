import { describe, it, expect } from 'bun:test';
import { toCloudEventWire, fromCloudEventWire } from '../../src/kafka/wire-codec.js';
import { CloudEventDecodeError } from '../../src/kafka/wire-errors.js';
import type { EventEnvelope } from '../../src/types/envelope.js';

function sampleEnvelope(overrides: Partial<EventEnvelope> = {}): EventEnvelope {
  return {
    id: 'ev-1',
    source: 'rntme://svc/Issue',
    eventType: 'IssueCreated',
    type: 'svc.Issue.IssueCreated',
    time: '2026-04-17T10:00:00.000Z',
    subject: 'Issue-abc',
    dataContentType: 'application/json',
    dataSchema: 'rntme://schemas/svc/IssueCreated.v1.json',
    data: { title: 'hello' },
    correlationId: 'corr-1',
    causationId: 'cmd-1',
    commandId: 'cmd-1',
    rntAggregateType: 'Issue',
    rntAggregateId: 'abc',
    rntVersion: 1,
    rntSchemaVersion: 1,
    rntActorKind: 'user',
    rntActorId: 'u1',
    traceparent: null,
    ...overrides,
  };
}

describe('wire-codec roundtrip', () => {
  it('roundtrips a fully populated envelope', () => {
    const env = sampleEnvelope();
    const msg = toCloudEventWire(env, 'rntme.svc.issue');
    const back = fromCloudEventWire(msg);
    expect(back).toEqual(env);
  });

  it('roundtrips with nullables absent', () => {
    const env = sampleEnvelope({
      causationId: null, commandId: null, traceparent: null,
      rntActorKind: null, rntActorId: null,
    });
    const msg = toCloudEventWire(env, 't');
    expect(msg.headers).not.toHaveProperty('ce_causationid');
    expect(msg.headers).not.toHaveProperty('ce_commandid');
    expect(msg.headers).not.toHaveProperty('ce_traceparent');
    expect(msg.headers).not.toHaveProperty('ce_rntactorkind');
    expect(msg.headers).not.toHaveProperty('ce_rntactorid');
    const back = fromCloudEventWire(msg);
    expect(back).toEqual(env);
  });

  it('serializes `data` as JSON in value (bit-exact)', () => {
    const env = sampleEnvelope({ data: { k: 'v', n: 42 } });
    const msg = toCloudEventWire(env, 't');
    expect(msg.value).toBe(JSON.stringify(env.data));
  });
});

describe('wire-codec decode errors', () => {
  const required = [
    'ce_id', 'ce_source', 'ce_type', 'ce_time', 'ce_subject',
    'ce_datacontenttype', 'ce_dataschema', 'ce_correlationid',
    'ce_rntaggregatetype', 'ce_rntaggregateid', 'ce_rntversion',
    'ce_rntschemaversion', 'ce_specversion',
  ];
  for (const h of required) {
    it(`throws MISSING_ATTR when ${h} absent`, () => {
      const msg = toCloudEventWire(sampleEnvelope(), 't');
      const { [h]: _, ...rest } = msg.headers;
      const broken = { ...msg, headers: rest };
      expect(() => fromCloudEventWire(broken)).toThrow(CloudEventDecodeError);
      expect(() => fromCloudEventWire(broken)).toThrow(/MISSING_ATTR/);
    });
  }

  it('throws UNKNOWN_SPEC for non-1.0 specversion', () => {
    const msg = toCloudEventWire(sampleEnvelope(), 't');
    const broken = { ...msg, headers: { ...msg.headers, ce_specversion: '0.3' } };
    expect(() => fromCloudEventWire(broken)).toThrow(/UNKNOWN_SPEC/);
  });

  it('throws INVALID_INT for non-integer ce_rntversion', () => {
    const msg = toCloudEventWire(sampleEnvelope(), 't');
    const broken = { ...msg, headers: { ...msg.headers, ce_rntversion: 'xx' } };
    expect(() => fromCloudEventWire(broken)).toThrow(/INVALID_INT/);
  });

  it('throws INVALID_ACTORKIND when ce_rntactorkind is present but not user|system|service', () => {
    const msg = toCloudEventWire(sampleEnvelope(), 't');
    const broken = { ...msg, headers: { ...msg.headers, ce_rntactorkind: 'bot' } };
    expect(() => fromCloudEventWire(broken)).toThrow(CloudEventDecodeError);
    expect(() => fromCloudEventWire(broken)).toThrow(/INVALID_ACTORKIND/);
  });
});
