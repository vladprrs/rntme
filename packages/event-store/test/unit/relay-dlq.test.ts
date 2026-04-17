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
