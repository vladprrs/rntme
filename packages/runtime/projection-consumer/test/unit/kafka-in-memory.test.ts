import { describe, it, expect } from 'bun:test';
import type { EventEnvelope } from '@rntme/event-store';
import type { ConsumedMessage } from '../../src/types/consumer.js';
import { createInMemoryKafkaConsumer } from '../../src/kafka/in-memory.js';

function envelope(overrides?: Partial<EventEnvelope>): EventEnvelope {
  return {
    id: 'e1',
    source: 'rntme://test/Issue',
    eventType: 'IssueReport',
    type: 'test.Issue.IssueReport',
    time: new Date().toISOString(),
    subject: 'Issue-1',
    dataContentType: 'application/json',
    dataSchema: 'rntme://schemas/test/IssueReport.v1.json',
    data: { before: null, after: { status: 'draft' } },
    correlationId: 'corr-1',
    causationId: null,
    commandId: null,
    rntAggregateType: 'Issue',
    rntAggregateId: '1',
    rntVersion: 1,
    rntSchemaVersion: 1,
    rntActorKind: 'user',
    rntActorId: 'alice',
    traceparent: null,
    ...overrides,
  };
}

describe('createInMemoryKafkaConsumer', () => {
  it('produces yields batches until stop()', async () => {
    const kafka = createInMemoryKafkaConsumer();
    kafka.produce(envelope({ id: 'a' }));
    kafka.produce(envelope({ id: 'b' }));
    const it = kafka[Symbol.asyncIterator]();
    const r1 = await it.next();
    expect(r1.done).toBe(false);
    expect(r1.value!.messages.map((m: ConsumedMessage) => m.envelope.id)).toEqual(['a', 'b']);
    kafka.stop();
    const r2 = await it.next();
    expect(r2.done).toBe(true);
  });

  it('subsequent produce between batches', async () => {
    const kafka = createInMemoryKafkaConsumer();
    kafka.produce(envelope({ id: 'a' }));
    const it = kafka[Symbol.asyncIterator]();
    const r1 = await it.next();
    expect(r1.value!.messages).toHaveLength(1);
    expect(r1.value!.messages[0]!.envelope.id).toBe('a');
    kafka.produce(envelope({ id: 'b' }));
    const r2 = await it.next();
    expect(r2.value!.messages).toHaveLength(1);
    expect(r2.value!.messages[0]!.envelope.id).toBe('b');
    kafka.stop();
    await it.next();
  });

  it('commitOffsets records last commit per batch', async () => {
    const kafka = createInMemoryKafkaConsumer();
    kafka.produce(envelope({ id: 'a' }));
    const it = kafka[Symbol.asyncIterator]();
    const { value: batch } = await it.next();
    await kafka.commitOffsets(batch!);
    expect(kafka.committed.map((m: ConsumedMessage) => m.envelope.id)).toEqual(['a']);
    kafka.stop();
    await it.next();
  });

  it('monotonic offsets 0,1 and partition 0', async () => {
    const kafka = createInMemoryKafkaConsumer();
    kafka.produce(envelope({ id: 'x' }));
    kafka.produce(envelope({ id: 'y' }));
    const it = kafka[Symbol.asyncIterator]();
    const { value: batch } = await it.next();
    expect(batch!.messages.map((m: ConsumedMessage) => m.offset)).toEqual(['0', '1']);
    expect(batch!.messages.every((m: ConsumedMessage) => m.partition === 0)).toBe(true);
    kafka.stop();
    await it.next();
  });

  it('default topic matches relay canonical format (serviceName extracted from envelope.source)', async () => {
    const kafka = createInMemoryKafkaConsumer();
    kafka.produce(envelope({ id: 'a', source: 'rntme://issue-tracker/Issue', rntAggregateType: 'Issue' }));
    const it = kafka[Symbol.asyncIterator]();
    const { value: batch } = await it.next();
    expect(batch!.messages[0]!.topic).toBe('rntme.issue-tracker.issue');
    kafka.stop();
    await it.next();
  });

  it('custom topicOf override receives full envelope', async () => {
    const kafka = createInMemoryKafkaConsumer({ topicOf: (e) => `custom:${e.rntAggregateType}` });
    kafka.produce(envelope({ id: 'a' }));
    const it = kafka[Symbol.asyncIterator]();
    const { value: batch } = await it.next();
    expect(batch!.messages[0]!.topic).toBe('custom:Issue');
    kafka.stop();
    await it.next();
  });
});
