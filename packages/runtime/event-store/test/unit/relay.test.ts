import { describe, it, expect, afterEach } from 'bun:test';
import { SqliteEventStore } from '../../src/store/sqlite.js';
import { createInMemoryKafkaProducer } from '../../src/kafka/in-memory.js';
import { createRelay } from '../../src/relay/loop.js';
import { defaultTopicOf } from '../../src/relay/topic.js';
import { fromCloudEventWire } from '../../src/kafka/wire-codec.js';
import { makeEvent, makeRequest } from '../fixtures/sample-events.js';

let store: SqliteEventStore | null = null;
afterEach(() => { store?.close(); store = null; });

async function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

describe('defaultTopicOf', () => {
  it('returns rntme.<serviceName>.<lower> for a PascalCase aggregate type', () => {
    expect(defaultTopicOf('svc', 'Issue')).toBe('rntme.svc.issue');
    expect(defaultTopicOf('svc', 'SprintItem')).toBe('rntme.svc.sprintitem');
  });
  it('lowercases the serviceName segment', () => {
    expect(defaultTopicOf('IssueTracker', 'Issue')).toBe('rntme.issuetracker.issue');
  });
  it('prefixes topics when an event-bus topic prefix is provided', () => {
    expect(defaultTopicOf('app', 'Note', 'rntme.rnt364.smoke')).toBe(
      'rntme.rnt364.smoke.app.note',
    );
  });
});

describe('createRelay', () => {
  it('publishes all events in event_log in id order and advances publish_cursor', async () => {
    store = newStore();
    const kafka = createInMemoryKafkaProducer();
    const relay = createRelay({
      store,
      kafka,
      cursorId: 'kafka-main',
      pollIntervalMs: 5,
      batchSize: 100,
      ...defaultRelayExtras(),
    });

    store.appendEvents([
      makeRequest('Issue-1', [
        makeEvent({ id: 'a', rntAggregateId: '1' }),
        makeEvent({ id: 'b', rntAggregateId: '1' }),
      ]),
      makeRequest('Issue-2', [
        makeEvent({ id: 'c', rntAggregateId: '2' }),
      ]),
    ]);

    relay.start();
    // Spin until all 3 events are published or timeout.
    const deadline = Date.now() + 2000;
    while (kafka.sent.length < 3 && Date.now() < deadline) {
      await wait(5);
    }
    await relay.stop();

    expect(kafka.sent.map((m) => m.key)).toEqual(['Issue-1', 'Issue-1', 'Issue-2']);
    expect(kafka.sent.map((m) => m.topic)).toEqual([
      'rntme.svc.issue', 'rntme.svc.issue', 'rntme.svc.issue',
    ]);
    // Each message is CE binary-mode: headers carry the envelope attributes,
    // value is the raw JSON payload (== envelope.data).
    expect(kafka.sent.every((m) => m.headers.ce_specversion === '1.0')).toBe(true);
    const decoded = kafka.sent.map((m) => fromCloudEventWire(m));
    expect(decoded.map((e) => e.id)).toEqual(['a', 'b', 'c']);
    expect(decoded[0]!.rntVersion).toBe(1);
    expect(decoded[1]!.rntVersion).toBe(2);
    expect(decoded[2]!.rntVersion).toBe(1);

    // Cursor advanced beyond the last id
    const cursor = store.readCursor('kafka-main');
    expect(cursor).toBeGreaterThanOrEqual(3);
  });

  it('emits CE binary-mode Kafka message with ce_* attribute headers', async () => {
    store = newStore();
    const kafka = createInMemoryKafkaProducer();
    const relay = createRelay({
      store, kafka, cursorId: 'kafka-main', pollIntervalMs: 5, batchSize: 100,
      ...defaultRelayExtras(),
    });
    store.appendEvents([makeRequest('Issue-1', [
      makeEvent({ id: 'a', eventType: 'IssueReport', rntSchemaVersion: 1 }),
    ])]);
    relay.start();
    const deadline = Date.now() + 1000;
    while (kafka.sent.length < 1 && Date.now() < deadline) await wait(5);
    await relay.stop();

    const m = kafka.sent[0]!;
    expect(m.topic).toBe('rntme.svc.issue');
    expect(m.key).toBe('Issue-1');
    expect(m.headers.ce_specversion).toBe('1.0');
    expect(m.headers.ce_id).toBe('a');
    expect(m.headers.ce_type).toBe('svc.Issue.IssueReport');
    expect(m.headers.ce_source).toBe('rntme://svc/Issue');
    expect(m.headers.ce_rntschemaversion).toBe('1');
    expect(m.headers.ce_rntaggregatetype).toBe('Issue');
    // value is the payload (`data`), not the whole envelope.
    expect(JSON.parse(m.value)).toEqual({ before: null, after: { status: 'draft' } });
  });

  it('retries after a transient Kafka failure (at-least-once, cursor only advances on success)', async () => {
    store = newStore();
    const kafka = createInMemoryKafkaProducer();
    const relay = createRelay({
      store, kafka, cursorId: 'kafka-main', pollIntervalMs: 5, batchSize: 100,
      ...defaultRelayExtras(),
    });

    store.appendEvents([makeRequest('Issue-1', [makeEvent({ id: 'a' })])]);

    // First send() will fail; relay should retry and eventually publish.
    kafka.failNext(1, new Error('kafka transient'));

    relay.start();
    const deadline = Date.now() + 2000;
    while (kafka.sent.length < 1 && Date.now() < deadline) await wait(5);
    await relay.stop();

    expect(kafka.sent).toHaveLength(1);
    expect(store.readCursor('kafka-main')).toBeGreaterThanOrEqual(1);
  });

  it('stop() resolves and prevents further publication', async () => {
    store = newStore();
    const kafka = createInMemoryKafkaProducer();
    const relay = createRelay({
      store, kafka, cursorId: 'kafka-main', pollIntervalMs: 5, batchSize: 100,
      ...defaultRelayExtras(),
    });
    relay.start();
    await relay.stop();

    store.appendEvents([makeRequest('Issue-1', [makeEvent({ id: 'a' })])]);
    await wait(30);
    expect(kafka.sent).toEqual([]);
  });
});
