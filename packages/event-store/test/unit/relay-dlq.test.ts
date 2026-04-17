import { describe, it, expect, afterEach } from 'vitest';
import { SqliteEventStore } from '../../src/store/sqlite.js';
import { createInMemoryKafkaProducer } from '../../src/kafka/in-memory.js';
import { createRelay } from '../../src/relay/loop.js';
import { fromCloudEventWire } from '../../src/kafka/wire-codec.js';
import type { DlqPayload } from '../../src/relay/dlq-envelope.js';
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

function defaultRelayExtras() {
  let idCounter = 0;
  return {
    serviceName: 'svc',
    now: () => '2026-04-17T00:00:00.000Z',
    nextId: () => `dlq-${++idCounter}`,
  };
}

describe('relay — delivery_tracking (happy path)', () => {
  it('records attempt_count=1 and delivered_at after a successful send', async () => {
    store = new SqliteEventStore({ filename: ':memory:', serviceName: 'svc' });
    const kafka = createInMemoryKafkaProducer();
    const relay = createRelay({
      store, kafka, cursorId: 'kafka-main', pollIntervalMs: 5, batchSize: 100,
      ...defaultRelayExtras(),
    });

    store.appendEvents([makeRequest('Issue-1', [makeEvent({ id: 'a' })])]);

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
    store = new SqliteEventStore({ filename: ':memory:', serviceName: 'svc' });
    const kafka = createInMemoryKafkaProducer();
    const relay = createRelay({
      store, kafka, cursorId: 'kafka-main', pollIntervalMs: 5, batchSize: 100,
      ...defaultRelayExtras(),
    });
    store.appendEvents([makeRequest('Issue-1', [makeEvent({ id: 'a' })])]);
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
    store = new SqliteEventStore({ filename: ':memory:', serviceName: 'svc' });
    const kafka = createInMemoryKafkaProducer();
    const relay = createRelay({
      store, kafka,
      cursorId: 'kafka-main',
      pollIntervalMs: 5,
      batchSize: 100,
      maxAttempts: 3,
      maxBackoffMs: 5,
      onSendError: () => { /* silence */ },
      ...defaultRelayExtras(),
    });
    store.appendEvents([makeRequest('Issue-1', [makeEvent({ id: 'a' })])]);
    // Fail exactly maxAttempts times — primary never succeeds; the next send()
    // is the DLQ emit, which succeeds because failures are exhausted.
    kafka.failNext(3, new Error('schema violation at broker'));

    relay.start();
    // Wait until we see exactly one DLQ message (primary-topic sends all fail; DLQ succeeds on first try).
    expect(await waitUntil(
      () => kafka.sent.some((m) => m.topic === 'rntme.svc.issue.v1.dlq'),
      3000,
    )).toBe(true);
    await relay.stop();

    const primaryMsgs = kafka.sent.filter((m) => m.topic === 'rntme.svc.issue.v1');
    const dlqMsgs = kafka.sent.filter((m) => m.topic === 'rntme.svc.issue.v1.dlq');
    expect(primaryMsgs).toHaveLength(0);
    expect(dlqMsgs).toHaveLength(1);

    const dlq = dlqMsgs[0]!;
    // DLQ message uses CE binary mode; partition key is the original subject
    // so the DLQ preserves per-aggregate ordering.
    expect(dlq.key).toBe('Issue-1');
    expect(dlq.headers.ce_specversion).toBe('1.0');
    expect(dlq.headers.ce_type).toBe('svc.Relay.EventDeliveryFailed');

    const decoded = fromCloudEventWire(dlq);
    expect(decoded.type).toBe('svc.Relay.EventDeliveryFailed');
    expect(decoded.source).toBe('rntme://svc/Relay');
    expect(decoded.rntAggregateType).toBe('Relay');
    expect(decoded.rntAggregateId).toBe('svc');
    expect(decoded.rntActorKind).toBe('system');
    expect(decoded.rntActorId).toBe('relay');
    expect(decoded.causationId).toBe('a');
    const payload = decoded.data as DlqPayload;
    expect(payload.reason).toBe('max-attempts-exceeded');
    expect(payload.attempts).toBe(3);
    expect(payload.lastError).toBe('schema violation at broker');
    expect(payload.failedEvent.id).toBe('a');

    expect(store.readCursor('kafka-main')).toBeGreaterThanOrEqual(1);
    const row = store.readDeliveryAttempt('a');
    expect(row?.attemptCount).toBe(3);
    expect(row?.dlqAt).not.toBeNull();
    expect(row?.deliveredAt).toBeNull();
    expect(row?.lastError).toBe('schema violation at broker');
  });

  it('does not mark dlq_at when relay is stopped during DLQ emit retry', async () => {
    store = new SqliteEventStore({ filename: ':memory:', serviceName: 'svc' });

    // Topic-aware mock: primary always fails; DLQ always fails too.
    // This simulates both topics being unreachable — emitDlq will loop.
    const sent: { topic: string; key: string; value: string; headers: Record<string, string> }[] = [];
    let dlqEmitCount = 0;
    const kafka = {
      sent,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async send(m: any): Promise<void> {
        if (m.topic.endsWith('.dlq')) {
          dlqEmitCount += 1;
        }
        throw new Error('broker unavailable');
      },
    };

    const relay = createRelay({
      store, kafka: kafka as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      cursorId: 'kafka-main',
      pollIntervalMs: 5,
      batchSize: 100,
      maxAttempts: 2,
      maxBackoffMs: 5,
      onSendError: () => {},
      ...defaultRelayExtras(),
    });
    store.appendEvents([makeRequest('Issue-1', [makeEvent({ id: 'a' })])]);

    relay.start();
    // Wait until the primary attempts are exhausted AND emitDlq has started retrying.
    // Indicator: attempt_count reached maxAttempts (2).
    expect(await waitUntil(
      () => (store!.readDeliveryAttempt('a')?.attemptCount ?? 0) >= 2,
      2000,
    )).toBe(true);
    // Wait until at least one DLQ emit attempt has been made.
    expect(await waitUntil(() => dlqEmitCount >= 1, 2000)).toBe(true);
    await relay.stop();

    const row = store.readDeliveryAttempt('a');
    expect(row?.attemptCount).toBe(2);
    expect(row?.dlqAt).toBeNull(); // <-- the key assertion: NOT marked
    expect(row?.deliveredAt).toBeNull();
    expect(store.readCursor('kafka-main')).toBe(0); // cursor did not advance
  });
});

describe('relay — defensive skip on terminal state', () => {
  it('does not call kafka.send when delivery_tracking already has delivered_at set', async () => {
    store = new SqliteEventStore({ filename: ':memory:', serviceName: 'svc' });
    const kafka = createInMemoryKafkaProducer();
    store.appendEvents([makeRequest('Issue-1', [makeEvent({ id: 'a' })])]);

    // Simulate a crash scenario: delivery_tracking terminal, cursor not advanced.
    store.recordDeliveryAttempt('a', '2026-04-17T10:00:00.000Z');
    store.markDelivered('a', '2026-04-17T10:00:01.000Z');

    const relay = createRelay({
      store, kafka, cursorId: 'kafka-main', pollIntervalMs: 5, batchSize: 100,
      ...defaultRelayExtras(),
    });
    relay.start();
    // Give the loop enough time to process; nothing should be sent, cursor should advance past 'a'.
    expect(await waitUntil(() => store!.readCursor('kafka-main') >= 1, 1000)).toBe(true);
    await relay.stop();

    expect(kafka.sent).toHaveLength(0);
  });

  it('does not call kafka.send when delivery_tracking already has dlq_at set', async () => {
    store = new SqliteEventStore({ filename: ':memory:', serviceName: 'svc' });
    const kafka = createInMemoryKafkaProducer();
    store.appendEvents([makeRequest('Issue-1', [makeEvent({ id: 'a' })])]);

    store.recordDeliveryAttempt('a', '2026-04-17T10:00:00.000Z');
    store.markDlq('a', '2026-04-17T10:00:01.000Z');

    const relay = createRelay({
      store, kafka, cursorId: 'kafka-main', pollIntervalMs: 5, batchSize: 100,
      ...defaultRelayExtras(),
    });
    relay.start();
    expect(await waitUntil(() => store!.readCursor('kafka-main') >= 1, 1000)).toBe(true);
    await relay.stop();

    expect(kafka.sent).toHaveLength(0);
  });
});
