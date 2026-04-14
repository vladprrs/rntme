import { describe, it, expect } from 'vitest';
import type { EventEnvelope } from '@rntme/event-store';
import { createInMemoryKafkaConsumer } from '../../src/kafka/in-memory.js';

function envelope(overrides?: Partial<EventEnvelope>): EventEnvelope {
  return {
    eventId: 'e1',
    eventType: 'Test',
    aggregateType: 'Thing',
    aggregateId: '1',
    stream: 'Thing-1',
    version: 1,
    occurredAt: new Date().toISOString(),
    actor: { kind: 'system', id: 'test' },
    payload: {},
    schemaVersion: 1,
    ...overrides,
  };
}

describe('createInMemoryKafkaConsumer', () => {
  it('yields batches whose messages use envelope.stream as partition key', async () => {
    const kafka = createInMemoryKafkaConsumer({ pollIntervalMs: 5 });
    const env = envelope({ stream: 'Order-42' });
    kafka.produce({ topic: 'rntme.order.v1', partition: 0, envelope: env });
    const it = kafka[Symbol.asyncIterator]();
    const { done, value: batch } = await it.next();
    expect(done).toBe(false);
    expect(batch!.messages).toHaveLength(1);
    const m = batch!.messages[0]!;
    expect(m.key).toBe('Order-42');
    expect(m.envelope).toEqual(env);
    expect(m.topic).toBe('rntme.order.v1');
    expect(m.partition).toBe(0);
    expect(typeof m.offset).toBe('string');
    kafka.stop();
    await it.next();
  });

  it('keeps commit history on `committed` only after await commitOffsets', async () => {
    const kafka = createInMemoryKafkaConsumer({ pollIntervalMs: 5 });
    kafka.produce({ topic: 't', partition: 0, envelope: envelope() });
    const it = kafka[Symbol.asyncIterator]();
    const { value: batch } = await it.next();
    expect(kafka.committed).toHaveLength(0);
    await kafka.commitOffsets(batch!);
    expect(kafka.committed).toHaveLength(1);
    expect(kafka.committed[0]).toBe(batch);
    kafka.stop();
    await it.next();
  });

  it('returns done from the async iterator after stop()', async () => {
    const kafka = createInMemoryKafkaConsumer({ pollIntervalMs: 5 });
    kafka.stop();
    const it = kafka[Symbol.asyncIterator]();
    const r = await it.next();
    expect(r.done).toBe(true);
  });

  it('yields an empty batch when the poll finds no queued messages', async () => {
    const kafka = createInMemoryKafkaConsumer({ pollIntervalMs: 5 });
    const it = kafka[Symbol.asyncIterator]();
    const { done, value: batch } = await it.next();
    expect(done).toBe(false);
    expect(batch!.messages).toEqual([]);
    kafka.stop();
    await it.next();
  });
});
