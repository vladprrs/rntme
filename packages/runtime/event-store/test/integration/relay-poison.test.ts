import { describe, it, expect, afterEach } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { SqliteEventStore } from '../../src/store/sqlite.js';
import { createInMemoryKafkaProducer } from '../../src/kafka/in-memory.js';
import { createRelay } from '../../src/relay/loop.js';
import type { KafkaMessage, KafkaProducer } from '../../src/kafka/producer.js';
import { fromCloudEventWire } from '../../src/kafka/wire-codec.js';
import type { DlqPayload } from '../../src/relay/dlq-envelope.js';
import { makeEvent, makeRequest } from '../fixtures/sample-events.js';

function defaultRelayExtras() {
  let idCounter = 0;
  return {
    serviceName: 'svc',
    now: () => '2026-04-17T00:00:00.000Z',
    nextId: () => `dlq-${++idCounter}`,
  };
}

let tmpDir: string | null = null;
let store: SqliteEventStore | null = null;
afterEach(() => {
  try {
    store?.close();
  } finally {
    store = null;
    if (tmpDir) { rmSync(tmpDir, { recursive: true, force: true }); tmpDir = null; }
  }
});

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitUntil(pred: () => boolean, timeoutMs = 3000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (!pred() && Date.now() < deadline) await wait(5);
  return pred();
}

/**
 * A topic-aware Kafka producer that always rejects sends to primary topics
 * but always accepts DLQ sends.  This avoids the shared-counter problem of
 * `failNext(N, …)` when DLQ sends are interleaved with primary sends in the
 * sequential relay loop.
 */
function makePoisonProducer(err: Error): KafkaProducer & { sent: KafkaMessage[] } {
  const sent: KafkaMessage[] = [];
  return {
    sent,
    async send(message: KafkaMessage): Promise<void> {
      if (message.topic.endsWith('.dlq')) {
        sent.push(message);
        return;
      }
      throw err;
    },
  };
}

describe('relay poison-event integration (A1 primary scenario)', () => {
  it('three always-failing events each DLQ after maxAttempts; cursor advances past all three', async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'rntme-relay-poison-'));
    const dbPath = join(tmpDir, 'events.db');
    store = new SqliteEventStore({ filename: dbPath, serviceName: 'svc' });

    const kafka = makePoisonProducer(new Error('broker-side schema violation'));

    store.appendEvents([makeRequest('Issue-1', [
      makeEvent({ id: 'a', rntAggregateId: '1' }),
      makeEvent({ id: 'b', rntAggregateId: '1' }),
    ])]);
    store.appendEvents([makeRequest('Issue-2', [
      makeEvent({ id: 'c', rntAggregateId: '2' }),
    ])]);

    const relay = createRelay({
      store, kafka,
      cursorId: 'kafka-main',
      pollIntervalMs: 5,
      batchSize: 100,
      maxAttempts: 3,
      maxBackoffMs: 5,
      onSendError: () => { /* silence for test stability */ },
      ...defaultRelayExtras(),
    });
    relay.start();

    expect(await waitUntil(
      () => kafka.sent.filter((m) => m.topic.endsWith('.dlq')).length >= 3,
      5000,
    )).toBe(true);
    await relay.stop();

    const primary = kafka.sent.filter((m) => !m.topic.endsWith('.dlq'));
    const dlq = kafka.sent.filter((m) => m.topic.endsWith('.dlq'));
    expect(primary).toHaveLength(0);
    expect(dlq).toHaveLength(3);

    // Each DLQ message wraps the original envelope in the CE wrapper event.
    const dlqPayloads = dlq.map((m) => fromCloudEventWire(m).data as DlqPayload);
    const dlqEventIds = dlqPayloads.map((p) => p.failedEvent.id).sort();
    expect(dlqEventIds).toEqual(['a', 'b', 'c']);
    for (const p of dlqPayloads) {
      expect(p.reason).toBe('max-attempts-exceeded');
      expect(p.attempts).toBe(3);
      expect(p.lastError).toBe('broker-side schema violation');
    }

    for (const id of ['a', 'b', 'c'] as const) {
      const row = store.readDeliveryAttempt(id);
      expect(row?.attemptCount).toBe(3);
      expect(row?.dlqAt).not.toBeNull();
      expect(row?.deliveredAt).toBeNull();
      expect(row?.lastError).toBe('broker-side schema violation');
    }

    // Cursor has advanced past all three events (id 1, 2, 3 in insertion order).
    expect(store.readCursor('kafka-main')).toBeGreaterThanOrEqual(3);
  });

  it('attempt_count persists across relay restart: poison event DLQ after exactly maxAttempts total attempts', async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'rntme-relay-restart-'));
    const dbPath = join(tmpDir, 'events.db');
    store = new SqliteEventStore({ filename: dbPath, serviceName: 'svc' });

    const kafka = createInMemoryKafkaProducer();
    kafka.failNext(10, new Error('broker unreachable'));

    store.appendEvents([makeRequest('Issue-1', [
      makeEvent({ id: 'a', rntAggregateId: '1' }),
    ])]);

    const relay1 = createRelay({
      store, kafka,
      cursorId: 'kafka-main',
      pollIntervalMs: 5,
      batchSize: 100,
      maxAttempts: 10,
      maxBackoffMs: 5,
      onSendError: () => {},
      ...defaultRelayExtras(),
    });
    relay1.start();
    // Wait for attempt_count to reach at least 4 on the poison event.
    expect(await waitUntil(
      () => (store!.readDeliveryAttempt('a')?.attemptCount ?? 0) >= 4,
      3000,
    )).toBe(true);
    await relay1.stop();

    const midCount = store.readDeliveryAttempt('a')?.attemptCount ?? 0;
    expect(midCount).toBeGreaterThanOrEqual(4);

    const relay2 = createRelay({
      store, kafka,
      cursorId: 'kafka-main',
      pollIntervalMs: 5,
      batchSize: 100,
      maxAttempts: 10,
      maxBackoffMs: 5,
      onSendError: () => {},
      ...defaultRelayExtras(),
    });
    relay2.start();
    expect(await waitUntil(
      () => kafka.sent.some((m) => m.topic.endsWith('.dlq')),
      5000,
    )).toBe(true);
    await relay2.stop();

    const row = store.readDeliveryAttempt('a');
    // Counter continued from midCount; final must be exactly maxAttempts (10).
    expect(row?.attemptCount).toBe(10);
    expect(row?.dlqAt).not.toBeNull();
    expect(store.readCursor('kafka-main')).toBeGreaterThanOrEqual(1);
  });

  it('DLQ persistently down: relay stays alive (no zombie state), stop() returns cleanly, dlq_at not marked, cursor not advanced', async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'rntme-relay-dlq-down-'));
    const dbPath = join(tmpDir, 'events.db');
    store = new SqliteEventStore({ filename: dbPath, serviceName: 'svc' });

    // Both primary AND DLQ topics permanently fail. Per spec §D-DLQ-RETRY,
    // the relay must keep retrying the DLQ send forever rather than zombify.
    let primaryAttempts = 0;
    let dlqAttempts = 0;
    const kafka: KafkaProducer = {
      async send(message: KafkaMessage): Promise<void> {
        if (message.topic.endsWith('.dlq')) {
          dlqAttempts += 1;
          throw new Error('dlq broker unreachable');
        }
        primaryAttempts += 1;
        throw new Error('primary broker unreachable');
      },
    };

    store.appendEvents([makeRequest('Issue-1', [
      makeEvent({ id: 'a', rntAggregateId: '1' }),
    ])]);

    const relay = createRelay({
      store, kafka,
      cursorId: 'kafka-main',
      pollIntervalMs: 5,
      batchSize: 100,
      maxAttempts: 3,
      maxBackoffMs: 5,
      onSendError: () => { /* silence */ },
      onDlqError: () => { /* silence */ },
      ...defaultRelayExtras(),
    });
    relay.start();

    // Primary should reach the cap (3); then DLQ retries unbounded.
    expect(await waitUntil(
      () => (store!.readDeliveryAttempt('a')?.attemptCount ?? 0) >= 3,
      3000,
    )).toBe(true);

    // Wait for several DLQ attempts — proves the DLQ loop is genuinely retrying.
    expect(await waitUntil(() => dlqAttempts >= 5, 3000)).toBe(true);
    const dlqAttemptsBefore = dlqAttempts;

    // Give the loop more time to confirm it keeps retrying (not zombied).
    await wait(50);
    expect(dlqAttempts).toBeGreaterThan(dlqAttemptsBefore);

    // stop() must return cleanly within a reasonable window (capped backoff is 5ms).
    const stopStart = Date.now();
    await relay.stop();
    const stopElapsed = Date.now() - stopStart;
    expect(stopElapsed).toBeLessThan(2000);

    // Counter capped at maxAttempts; DLQ never marked; cursor never advanced.
    const row = store.readDeliveryAttempt('a');
    expect(row?.attemptCount).toBe(3);
    expect(row?.dlqAt).toBeNull();
    expect(row?.deliveredAt).toBeNull();
    expect(store.readCursor('kafka-main')).toBe(0);

    // Sanity: the relay actually did work (didn't sleep through everything).
    expect(primaryAttempts).toBeGreaterThanOrEqual(3);
  });

  it('start() after stop() resumes cleanly when DLQ recovers', async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'rntme-relay-dlq-recover-'));
    const dbPath = join(tmpDir, 'events.db');
    store = new SqliteEventStore({ filename: dbPath, serviceName: 'svc' });

    let dlqShouldFail = true;
    const sent: KafkaMessage[] = [];
    const kafka: KafkaProducer & { sent: KafkaMessage[] } = {
      sent,
      async send(message: KafkaMessage): Promise<void> {
        if (message.topic.endsWith('.dlq')) {
          if (dlqShouldFail) throw new Error('dlq down');
          sent.push(message);
          return;
        }
        throw new Error('primary broker unreachable');
      },
    };

    store.appendEvents([makeRequest('Issue-1', [
      makeEvent({ id: 'a', rntAggregateId: '1' }),
    ])]);

    const relay1 = createRelay({
      store, kafka,
      cursorId: 'kafka-main',
      pollIntervalMs: 5,
      batchSize: 100,
      maxAttempts: 2,
      maxBackoffMs: 5,
      onSendError: () => {},
      onDlqError: () => {},
      ...defaultRelayExtras(),
    });
    relay1.start();
    expect(await waitUntil(
      () => (store!.readDeliveryAttempt('a')?.attemptCount ?? 0) >= 2,
      3000,
    )).toBe(true);
    await relay1.stop();

    // Counter at cap, DLQ never marked.
    expect(store.readDeliveryAttempt('a')?.dlqAt).toBeNull();
    expect(store.readDeliveryAttempt('a')?.attemptCount).toBe(2);

    // DLQ recovers; restart the relay. The I4 short-circuit must skip the
    // wasted primary send and go straight to DLQ.
    dlqShouldFail = false;
    const primaryBefore = sent.filter((m) => !m.topic.endsWith('.dlq')).length;

    const relay2 = createRelay({
      store, kafka,
      cursorId: 'kafka-main',
      pollIntervalMs: 5,
      batchSize: 100,
      maxAttempts: 2,
      maxBackoffMs: 5,
      onSendError: () => {},
      onDlqError: () => {},
      ...defaultRelayExtras(),
    });
    relay2.start();
    expect(await waitUntil(() => sent.some((m) => m.topic.endsWith('.dlq')), 3000)).toBe(true);
    await relay2.stop();

    const dlqMsgs = sent.filter((m) => m.topic.endsWith('.dlq'));
    expect(dlqMsgs).toHaveLength(1);
    // No additional primary send was issued on restart (I4 short-circuit).
    expect(sent.filter((m) => !m.topic.endsWith('.dlq')).length).toBe(primaryBefore);
    // attempt_count not bumped past the cap by the short-circuit path.
    expect(store.readDeliveryAttempt('a')?.attemptCount).toBe(2);
    expect(store.readDeliveryAttempt('a')?.dlqAt).not.toBeNull();
    expect(store.readCursor('kafka-main')).toBeGreaterThanOrEqual(1);
  });
});
