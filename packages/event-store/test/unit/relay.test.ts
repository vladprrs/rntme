import { describe, it, expect, afterEach } from 'vitest';
import { SqliteEventStore } from '../../src/store/sqlite.js';
import { createInMemoryKafkaProducer } from '../../src/kafka/in-memory.js';
import { createRelay } from '../../src/relay/loop.js';
import { defaultTopicOf } from '../../src/relay/topic.js';
import { makeEvent, makeRequest } from '../fixtures/sample-events.js';

let store: SqliteEventStore | null = null;
afterEach(() => { store?.close(); store = null; });

async function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function newStore(): SqliteEventStore {
  return new SqliteEventStore({ filename: ':memory:', serviceName: 'test-service' });
}

describe('defaultTopicOf', () => {
  it('returns rntme.<lower>.v1 for a PascalCase aggregate type', () => {
    expect(defaultTopicOf('Issue')).toBe('rntme.issue.v1');
    expect(defaultTopicOf('SprintItem')).toBe('rntme.sprintitem.v1');
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
      'rntme.issue.v1', 'rntme.issue.v1', 'rntme.issue.v1',
    ]);
    const values = kafka.sent.map((m) => JSON.parse(m.value) as { id: string; rntVersion: number });
    expect(values.map((v) => v.id)).toEqual(['a', 'b', 'c']);
    expect(values[0]!.rntVersion).toBe(1);
    expect(values[1]!.rntVersion).toBe(2);
    expect(values[2]!.rntVersion).toBe(1);

    // Cursor advanced beyond the last id
    const cursor = store.readCursor('kafka-main');
    expect(cursor).toBeGreaterThanOrEqual(3);
  });

  it('sends event-id, event-type, schema-version as Kafka headers', async () => {
    store = newStore();
    const kafka = createInMemoryKafkaProducer();
    const relay = createRelay({
      store, kafka, cursorId: 'kafka-main', pollIntervalMs: 5, batchSize: 100,
    });
    store.appendEvents([makeRequest('Issue-1', [
      makeEvent({ id: 'a', eventType: 'IssueReport', rntSchemaVersion: 1 }),
    ])]);
    relay.start();
    const deadline = Date.now() + 1000;
    while (kafka.sent.length < 1 && Date.now() < deadline) await wait(5);
    await relay.stop();

    const m = kafka.sent[0]!;
    expect(m.headers['event-id']).toBe('a');
    expect(m.headers['event-type']).toBe('IssueReport');
    expect(m.headers['schema-version']).toBe('1');
  });

  it('retries after a transient Kafka failure (at-least-once, cursor only advances on success)', async () => {
    store = newStore();
    const kafka = createInMemoryKafkaProducer();
    const relay = createRelay({
      store, kafka, cursorId: 'kafka-main', pollIntervalMs: 5, batchSize: 100,
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
    });
    relay.start();
    await relay.stop();

    store.appendEvents([makeRequest('Issue-1', [makeEvent({ id: 'a' })])]);
    await wait(30);
    expect(kafka.sent).toEqual([]);
  });
});
