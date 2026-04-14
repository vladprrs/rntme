import { describe, it, expect } from 'vitest';
import type { EventEnvelope } from '@rntme/event-store';
import type { ConsumedMessage } from '../../src/types/consumer.js';
import { createInMemoryKafkaConsumer } from '../../src/kafka/in-memory.js';

function envelope(overrides?: Partial<EventEnvelope>): EventEnvelope {
  return {
    eventId: 'e1',
    eventType: 'IssueReport',
    aggregateType: 'Issue',
    aggregateId: '1',
    stream: 'Issue-1',
    version: 1,
    occurredAt: new Date().toISOString(),
    actor: { kind: 'user', id: 'alice' },
    payload: { before: null, after: { status: 'draft' } },
    schemaVersion: 1,
    ...overrides,
  };
}

describe('createInMemoryKafkaConsumer', () => {
  it('produces yields batches until stop()', async () => {
    const kafka = createInMemoryKafkaConsumer();
    kafka.produce(envelope({ eventId: 'a' }));
    kafka.produce(envelope({ eventId: 'b' }));
    const it = kafka[Symbol.asyncIterator]();
    const r1 = await it.next();
    expect(r1.done).toBe(false);
    expect(r1.value!.messages.map((m: ConsumedMessage) => m.envelope.eventId)).toEqual(['a', 'b']);
    kafka.stop();
    const r2 = await it.next();
    expect(r2.done).toBe(true);
  });

  it('subsequent produce between batches', async () => {
    const kafka = createInMemoryKafkaConsumer();
    kafka.produce(envelope({ eventId: 'a' }));
    const it = kafka[Symbol.asyncIterator]();
    const r1 = await it.next();
    expect(r1.value!.messages).toHaveLength(1);
    expect(r1.value!.messages[0]!.envelope.eventId).toBe('a');
    kafka.produce(envelope({ eventId: 'b' }));
    const r2 = await it.next();
    expect(r2.value!.messages).toHaveLength(1);
    expect(r2.value!.messages[0]!.envelope.eventId).toBe('b');
    kafka.stop();
    await it.next();
  });

  it('commitOffsets records last commit per batch', async () => {
    const kafka = createInMemoryKafkaConsumer();
    kafka.produce(envelope({ eventId: 'a' }));
    const it = kafka[Symbol.asyncIterator]();
    const { value: batch } = await it.next();
    await kafka.commitOffsets(batch!);
    expect(kafka.committed.map((m: ConsumedMessage) => m.envelope.eventId)).toEqual(['a']);
    kafka.stop();
    await it.next();
  });

  it('monotonic offsets 0,1 and partition 0', async () => {
    const kafka = createInMemoryKafkaConsumer();
    kafka.produce(envelope({ eventId: 'x' }));
    kafka.produce(envelope({ eventId: 'y' }));
    const it = kafka[Symbol.asyncIterator]();
    const { value: batch } = await it.next();
    expect(batch!.messages.map((m: ConsumedMessage) => m.offset)).toEqual(['0', '1']);
    expect(batch!.messages.every((m: ConsumedMessage) => m.partition === 0)).toBe(true);
    kafka.stop();
    await it.next();
  });
});
