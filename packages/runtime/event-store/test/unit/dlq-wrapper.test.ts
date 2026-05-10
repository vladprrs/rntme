import { describe, it, expect, afterEach } from 'bun:test';
import { SqliteEventStore } from '../../src/store/sqlite.js';
import { createRelay } from '../../src/relay/loop.js';
import type { KafkaMessage, KafkaProducer } from '../../src/kafka/producer.js';
import { fromCloudEventWire } from '../../src/kafka/wire-codec.js';
import type { DlqPayload } from '../../src/relay/dlq-envelope.js';
import type { EventEnvelope } from '../../src/types/envelope.js';
import { makeEvent, makeRequest } from '../fixtures/sample-events.js';

let store: SqliteEventStore | null = null;
afterEach(() => { store?.close(); store = null; });

async function waitForCondition(pred: () => boolean, timeoutMs = 3000): Promise<void> {
  const start = Date.now();
  while (!pred()) {
    if (Date.now() - start > timeoutMs) throw new Error('condition never satisfied');
    await new Promise((r) => setTimeout(r, 5));
  }
}

const TRACEPARENT = '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01';

function makeStoreWithOneEvent(): { store: SqliteEventStore; originalEnv: EventEnvelope } {
  const s = new SqliteEventStore({ filename: ':memory:', serviceName: 'svc' });
  s.appendEvents([makeRequest('Issue-1', [
    makeEvent({
      id: 'orig-1',
      rntAggregateId: '1',
      correlationId: 'corr-xyz',
      traceparent: TRACEPARENT,
    }),
  ])]);
  const originalEnv = s.readStream('Issue-1')[0]!;
  return { store: s, originalEnv };
}

describe('relay wraps original event in EventDeliveryFailed on DLQ emit', () => {
  it('wraps after max-attempts-exceeded', async () => {
    const sent: KafkaMessage[] = [];
    let primaryAttempts = 0;
    // Fail the first 3 primary-topic sends (matches maxAttempts=3);
    // DLQ sends always succeed.
    const kafka: KafkaProducer = {
      async send(m): Promise<void> {
        if (!m.topic.endsWith('.dlq')) {
          primaryAttempts += 1;
          if (primaryAttempts <= 3) throw new Error('broker down');
        }
        sent.push(m);
      },
    };
    const seeded = makeStoreWithOneEvent();
    store = seeded.store;
    const { originalEnv } = seeded;

    const relay = createRelay({
      store,
      kafka,
      cursorId: 'kafka-main',
      pollIntervalMs: 5,
      batchSize: 100,
      maxAttempts: 3,
      maxBackoffMs: 5,
      onSendError: () => { /* silence */ },
      serviceName: 'svc',
      now: () => '2026-04-17T00:00:00.000Z',
      nextId: () => 'dlq-id-1',
    });
    relay.start();
    await waitForCondition(() => sent.some((m) => m.topic.endsWith('.dlq')));
    await relay.stop();

    const dlqMsg = sent.find((m) => m.topic.endsWith('.dlq'))!;
    expect(dlqMsg.topic).toBe('rntme.svc.issue.dlq');
    expect(dlqMsg.key).toBe(originalEnv.subject);

    const decoded = fromCloudEventWire(dlqMsg);
    expect(decoded.id).toBe('dlq-id-1');
    expect(decoded.type).toBe('svc.Relay.EventDeliveryFailed');
    expect(decoded.eventType).toBe('EventDeliveryFailed');
    expect(decoded.source).toBe('rntme://svc/Relay');
    expect(decoded.time).toBe('2026-04-17T00:00:00.000Z');
    expect(decoded.subject).toBe(originalEnv.subject);
    expect(decoded.dataSchema).toBe('rntme://schemas/svc/EventDeliveryFailed.v1.json');
    expect(decoded.correlationId).toBe(originalEnv.correlationId);
    expect(decoded.causationId).toBe(originalEnv.id);
    expect(decoded.commandId).toBeNull();
    expect(decoded.rntAggregateType).toBe('Relay');
    expect(decoded.rntAggregateId).toBe('svc');
    expect(decoded.rntVersion).toBe(0);
    expect(decoded.rntSchemaVersion).toBe(1);
    expect(decoded.rntActorKind).toBe('system');
    expect(decoded.rntActorId).toBe('relay');
    expect(decoded.traceparent).toBe(originalEnv.traceparent);
    expect(decoded.traceparent).toBe('00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01');

    const payload = decoded.data as DlqPayload;
    expect(payload.failedEvent).toEqual(originalEnv);
    expect(payload.reason).toBe('max-attempts-exceeded');
    expect(payload.attempts).toBe(3);
    expect(payload.firstAttemptAt).toMatch(/^20\d{2}-/);
    expect(payload.lastError).toMatch(/broker down/);
  });
});
