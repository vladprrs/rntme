import { describe, it, expect, afterEach } from 'vitest';
import {
  VERSION,
  SqliteEventStore,
  createInMemoryKafkaProducer,
  createRelay,
  defaultTopicOf,
  ConcurrencyConflict,
} from '../src/index.js';
import type { EventEnvelope, AppendRequest } from '../src/index.js';
import { makeEvent, makeRequest } from './fixtures/sample-events.js';

let store: SqliteEventStore | null = null;
afterEach(() => { store?.close(); store = null; });

async function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

describe('smoke: @rntme/event-store end-to-end', () => {
  it('exports VERSION', () => {
    expect(VERSION).toBe('0.0.0');
  });

  it('append → relay → kafka: full issue lifecycle preserves per-stream order', async () => {
    store = new SqliteEventStore({ filename: ':memory:' });
    const kafka = createInMemoryKafkaProducer();
    const relay = createRelay({
      store, kafka, cursorId: 'kafka-main', pollIntervalMs: 5, batchSize: 50,
    });

    // Two interleaved aggregates; per-stream order must be preserved in Kafka.
    const ops: AppendRequest[] = [
      makeRequest('Issue-1', [makeEvent({ eventId: 'i1-report', eventType: 'IssueReport', aggregateId: '1' })]),
      makeRequest('Issue-2', [makeEvent({ eventId: 'i2-report', eventType: 'IssueReport', aggregateId: '2' })]),
      makeRequest('Issue-1', [makeEvent({ eventId: 'i1-submit', eventType: 'IssueSubmit', aggregateId: '1' })]),
      makeRequest('Issue-1', [makeEvent({ eventId: 'i1-assign', eventType: 'IssueAssign', aggregateId: '1' })]),
      makeRequest('Issue-2', [makeEvent({ eventId: 'i2-submit', eventType: 'IssueSubmit', aggregateId: '2' })]),
    ];
    for (const op of ops) store.appendEvents([op]);

    relay.start();
    const deadline = Date.now() + 3000;
    while (kafka.sent.length < 5 && Date.now() < deadline) await wait(5);
    await relay.stop();

    expect(kafka.sent).toHaveLength(5);
    const envelopes: EventEnvelope[] = kafka.sent.map((m) => JSON.parse(m.value) as EventEnvelope);

    // Per-stream order within each aggregate's sub-sequence
    const issue1 = envelopes.filter((e) => e.stream === 'Issue-1').map((e) => e.eventId);
    expect(issue1).toEqual(['i1-report', 'i1-submit', 'i1-assign']);
    const issue2 = envelopes.filter((e) => e.stream === 'Issue-2').map((e) => e.eventId);
    expect(issue2).toEqual(['i2-report', 'i2-submit']);

    // Kafka partition key = stream
    expect(kafka.sent.every((m) => m.key === JSON.parse(m.value).stream)).toBe(true);

    // Topic naming
    expect(kafka.sent.every((m) => m.topic === defaultTopicOf('Issue'))).toBe(true);

    // Cursor ended at the last event id
    const lastId = (store.rawDb().prepare('SELECT MAX(id) AS m FROM event_log').get() as { m: number }).m;
    expect(store.readCursor('kafka-main')).toBe(lastId);
  });

  it('replay via readStream returns all appended events in version order (event-sourced aggregate replay)', () => {
    store = new SqliteEventStore({ filename: ':memory:' });
    store.appendEvents([makeRequest('Issue-1', [makeEvent({ eventId: 'a' })], 0)]);
    store.appendEvents([makeRequest('Issue-1', [makeEvent({ eventId: 'b' })], 1)]);
    store.appendEvents([makeRequest('Issue-1', [makeEvent({ eventId: 'c' })], 2)]);

    const events = store.readStream('Issue-1');
    expect(events.map((e) => [e.eventId, e.version])).toEqual([
      ['a', 1], ['b', 2], ['c', 3],
    ]);
  });

  it('ConcurrencyConflict bubbles up as a typed error for the command runtime to catch', () => {
    store = new SqliteEventStore({ filename: ':memory:' });
    store.appendEvents([makeRequest('Issue-1', [makeEvent({ eventId: 'a' })], 0)]);
    expect(() =>
      store!.appendEvents([makeRequest('Issue-1', [makeEvent({ eventId: 'b' })], 0)]),
    ).toThrow(ConcurrencyConflict);
  });
});
