import { describe, it, expect, afterEach } from 'vitest';
import {
  VERSION,
  SqliteEventStore,
  createInMemoryKafkaProducer,
  createRelay,
  defaultTopicOf,
  fromCloudEventWire,
  ConcurrencyConflict,
} from '../src/index.js';
import type { EventEnvelope, AppendRequest } from '../src/index.js';
import { makeEvent, makeRequest } from './fixtures/sample-events.js';

let store: SqliteEventStore | null = null;
afterEach(() => { store?.close(); store = null; });

async function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function newStore(): SqliteEventStore {
  return new SqliteEventStore({ filename: ':memory:', serviceName: 'svc' });
}

function defaultRelayExtras() {
  let idCounter = 0;
  return {
    serviceName: 'svc',
    now: () => '2026-04-17T00:00:00.000Z',
    nextId: () => `dlq-${++idCounter}`,
  };
}

describe('smoke: @rntme/event-store end-to-end', () => {
  it('exports VERSION', () => {
    expect(VERSION).toBe('0.0.0');
  });

  it('append → relay → kafka: full issue lifecycle preserves per-subject order', async () => {
    store = newStore();
    const kafka = createInMemoryKafkaProducer();
    const relay = createRelay({
      store, kafka, cursorId: 'kafka-main', pollIntervalMs: 5, batchSize: 50,
      ...defaultRelayExtras(),
    });

    // Two interleaved aggregates; per-subject order must be preserved in Kafka.
    const ops: AppendRequest[] = [
      makeRequest('Issue-1', [makeEvent({ id: 'i1-report', eventType: 'IssueReport', rntAggregateId: '1' })]),
      makeRequest('Issue-2', [makeEvent({ id: 'i2-report', eventType: 'IssueReport', rntAggregateId: '2' })]),
      makeRequest('Issue-1', [makeEvent({ id: 'i1-submit', eventType: 'IssueSubmit', rntAggregateId: '1' })]),
      makeRequest('Issue-1', [makeEvent({ id: 'i1-assign', eventType: 'IssueAssign', rntAggregateId: '1' })]),
      makeRequest('Issue-2', [makeEvent({ id: 'i2-submit', eventType: 'IssueSubmit', rntAggregateId: '2' })]),
    ];
    for (const op of ops) store.appendEvents([op]);

    relay.start();
    const deadline = Date.now() + 3000;
    while (kafka.sent.length < 5 && Date.now() < deadline) await wait(5);
    await relay.stop();

    expect(kafka.sent).toHaveLength(5);
    const envelopes: EventEnvelope[] = kafka.sent.map((m) => fromCloudEventWire(m));

    // Per-subject order within each aggregate's sub-sequence
    const issue1 = envelopes.filter((e) => e.subject === 'Issue-1').map((e) => e.id);
    expect(issue1).toEqual(['i1-report', 'i1-submit', 'i1-assign']);
    const issue2 = envelopes.filter((e) => e.subject === 'Issue-2').map((e) => e.id);
    expect(issue2).toEqual(['i2-report', 'i2-submit']);

    // Kafka partition key = envelope.subject
    expect(kafka.sent.every((m, i) => m.key === envelopes[i]!.subject)).toBe(true);

    // Topic naming (D6): `rntme.<serviceName>.<aggregateType>` (no version — versioning lives on the event)
    expect(kafka.sent.every((m) => m.topic === defaultTopicOf('svc', 'Issue'))).toBe(true);

    // Cursor ended at the last event id
    const lastId = (store.rawDb().prepare('SELECT MAX(id) AS m FROM event_log').get() as { m: number }).m;
    expect(store.readCursor('kafka-main')).toBe(lastId);
  });

  it('replay via readStream returns all appended events in version order (event-sourced aggregate replay)', () => {
    store = newStore();
    store.appendEvents([makeRequest('Issue-1', [makeEvent({ id: 'a' })], 0)]);
    store.appendEvents([makeRequest('Issue-1', [makeEvent({ id: 'b' })], 1)]);
    store.appendEvents([makeRequest('Issue-1', [makeEvent({ id: 'c' })], 2)]);

    const events = store.readStream('Issue-1');
    expect(events.map((e) => [e.id, e.rntVersion])).toEqual([
      ['a', 1], ['b', 2], ['c', 3],
    ]);
  });

  it('ConcurrencyConflict bubbles up as a typed error for the command runtime to catch', () => {
    store = newStore();
    store.appendEvents([makeRequest('Issue-1', [makeEvent({ id: 'a' })], 0)]);
    expect(() =>
      store!.appendEvents([makeRequest('Issue-1', [makeEvent({ id: 'b' })], 0)]),
    ).toThrow(ConcurrencyConflict);
  });
});
