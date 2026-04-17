import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { SqliteEventStore } from '../../src/store/sqlite.js';
import { createInMemoryKafkaProducer } from '../../src/kafka/in-memory.js';
import { createRelay } from '../../src/relay/loop.js';
import type { KafkaMessage, KafkaProducer } from '../../src/kafka/producer.js';
import { makeEvent, makeRequest } from '../fixtures/sample-events.js';

let tmpDir: string | null = null;
let store: SqliteEventStore | null = null;
afterEach(() => {
  store?.close();
  store = null;
  if (tmpDir) { rmSync(tmpDir, { recursive: true, force: true }); tmpDir = null; }
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
    store = new SqliteEventStore({ filename: dbPath });

    const kafka = makePoisonProducer(new Error('broker-side schema violation'));

    store.appendEvents([makeRequest('Issue-1', [
      makeEvent({ eventId: 'a', aggregateId: '1' }),
      makeEvent({ eventId: 'b', aggregateId: '1' }),
    ])]);
    store.appendEvents([makeRequest('Issue-2', [
      makeEvent({ eventId: 'c', aggregateId: '2' }),
    ])]);

    const relay = createRelay({
      store, kafka,
      cursorId: 'kafka-main',
      pollIntervalMs: 5,
      batchSize: 100,
      maxAttempts: 3,
      maxBackoffMs: 5,
      onSendError: () => { /* silence for test stability */ },
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

    const dlqEventIds = dlq.map((m) => m.headers['event-id']).sort();
    expect(dlqEventIds).toEqual(['a', 'b', 'c']);

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
});
