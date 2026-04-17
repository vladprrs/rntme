import { describe, it, expect, afterEach } from 'vitest';
import { SqliteEventStore } from '../../src/store/sqlite.js';
import { createInMemoryKafkaProducer } from '../../src/kafka/in-memory.js';
import { createRelay } from '../../src/relay/loop.js';
import { makeEvent, makeRequest } from '../fixtures/sample-events.js';

let store: SqliteEventStore | null = null;
afterEach(() => { store?.close(); store = null; });

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitUntil(pred: () => boolean, timeoutMs = 2000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (!pred() && Date.now() < deadline) await wait(5);
  return pred();
}

describe('relay — delivery_tracking (happy path)', () => {
  it('records attempt_count=1 and delivered_at after a successful send', async () => {
    store = new SqliteEventStore({ filename: ':memory:' });
    const kafka = createInMemoryKafkaProducer();
    const relay = createRelay({
      store, kafka, cursorId: 'kafka-main', pollIntervalMs: 5, batchSize: 100,
    });

    store.appendEvents([makeRequest('Issue-1', [makeEvent({ eventId: 'a' })])]);

    relay.start();
    expect(await waitUntil(() => kafka.sent.length >= 1)).toBe(true);
    await relay.stop();

    const row = store.readDeliveryAttempt('a');
    expect(row?.attemptCount).toBe(1);
    expect(row?.deliveredAt).not.toBeNull();
    expect(row?.dlqAt).toBeNull();
    expect(row?.lastError).toBeNull();
  });

  it('increments attempt_count per retry and retains last_error after eventual success', async () => {
    store = new SqliteEventStore({ filename: ':memory:' });
    const kafka = createInMemoryKafkaProducer();
    const relay = createRelay({
      store, kafka, cursorId: 'kafka-main', pollIntervalMs: 5, batchSize: 100,
    });
    store.appendEvents([makeRequest('Issue-1', [makeEvent({ eventId: 'a' })])]);
    kafka.failNext(2, new Error('transient broker hiccup'));

    relay.start();
    expect(await waitUntil(() => kafka.sent.length >= 1)).toBe(true);
    await relay.stop();

    const row = store.readDeliveryAttempt('a');
    expect(row?.attemptCount).toBe(3);
    expect(row?.deliveredAt).not.toBeNull();
    expect(row?.dlqAt).toBeNull();
    expect(row?.lastError).toBe('transient broker hiccup');
  });
});

describe('relay — DLQ path', () => {
  it('emits to {topic}.dlq after maxAttempts primary failures, advances cursor, marks dlq_at', async () => {
    store = new SqliteEventStore({ filename: ':memory:' });
    const kafka = createInMemoryKafkaProducer();
    const relay = createRelay({
      store, kafka,
      cursorId: 'kafka-main',
      pollIntervalMs: 5,
      batchSize: 100,
      maxAttempts: 3,
      maxBackoffMs: 5,
      onSendError: () => { /* silence */ },
    });
    store.appendEvents([makeRequest('Issue-1', [makeEvent({ eventId: 'a' })])]);
    // Fail exactly maxAttempts times — primary never succeeds; the next send()
    // is the DLQ emit, which succeeds because failures are exhausted.
    kafka.failNext(3, new Error('schema violation at broker'));

    relay.start();
    // Wait until we see exactly one DLQ message (primary-topic sends all fail; DLQ succeeds on first try).
    expect(await waitUntil(
      () => kafka.sent.some((m) => m.topic === 'rntme.issue.v1.dlq'),
      3000,
    )).toBe(true);
    await relay.stop();

    const primaryMsgs = kafka.sent.filter((m) => m.topic === 'rntme.issue.v1');
    const dlqMsgs = kafka.sent.filter((m) => m.topic === 'rntme.issue.v1.dlq');
    expect(primaryMsgs).toHaveLength(0);
    expect(dlqMsgs).toHaveLength(1);

    const dlq = dlqMsgs[0]!;
    expect(dlq.key).toBe('Issue-1');
    expect(dlq.headers['event-id']).toBe('a');
    expect(dlq.headers['event-type']).toBe('IssueReport');
    expect(dlq.headers['schema-version']).toBe('1');
    expect(dlq.headers['x-dlq-reason']).toBe('max-attempts-exceeded');
    expect(dlq.headers['x-dlq-attempts']).toBe('3');
    expect(dlq.headers['x-dlq-first-attempt-at']).toMatch(/^20\d{2}-/);
    expect(dlq.headers['x-dlq-last-error']).toBe('schema violation at broker');
    // Envelope value preserved verbatim.
    const value = JSON.parse(dlq.value) as { eventId: string };
    expect(value.eventId).toBe('a');

    expect(store.readCursor('kafka-main')).toBeGreaterThanOrEqual(1);
    const row = store.readDeliveryAttempt('a');
    expect(row?.attemptCount).toBe(3);
    expect(row?.dlqAt).not.toBeNull();
    expect(row?.deliveredAt).toBeNull();
    expect(row?.lastError).toBe('schema violation at broker');
  });
});

describe('relay — defensive skip on terminal state', () => {
  it('does not call kafka.send when delivery_tracking already has delivered_at set', async () => {
    store = new SqliteEventStore({ filename: ':memory:' });
    const kafka = createInMemoryKafkaProducer();
    store.appendEvents([makeRequest('Issue-1', [makeEvent({ eventId: 'a' })])]);

    // Simulate a crash scenario: delivery_tracking terminal, cursor not advanced.
    store.recordDeliveryAttempt('a', '2026-04-17T10:00:00.000Z');
    store.markDelivered('a', '2026-04-17T10:00:01.000Z');

    const relay = createRelay({
      store, kafka, cursorId: 'kafka-main', pollIntervalMs: 5, batchSize: 100,
    });
    relay.start();
    // Give the loop enough time to process; nothing should be sent, cursor should advance past 'a'.
    expect(await waitUntil(() => store!.readCursor('kafka-main') >= 1, 1000)).toBe(true);
    await relay.stop();

    expect(kafka.sent).toHaveLength(0);
  });

  it('does not call kafka.send when delivery_tracking already has dlq_at set', async () => {
    store = new SqliteEventStore({ filename: ':memory:' });
    const kafka = createInMemoryKafkaProducer();
    store.appendEvents([makeRequest('Issue-1', [makeEvent({ eventId: 'a' })])]);

    store.recordDeliveryAttempt('a', '2026-04-17T10:00:00.000Z');
    store.markDlq('a', '2026-04-17T10:00:01.000Z');

    const relay = createRelay({
      store, kafka, cursorId: 'kafka-main', pollIntervalMs: 5, batchSize: 100,
    });
    relay.start();
    expect(await waitUntil(() => store!.readCursor('kafka-main') >= 1, 1000)).toBe(true);
    await relay.stop();

    expect(kafka.sent).toHaveLength(0);
  });
});
