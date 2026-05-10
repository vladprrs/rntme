import { describe, it, expect } from 'bun:test';
import { createInMemoryKafkaProducer } from '../../src/kafka/in-memory.js';

describe('createInMemoryKafkaProducer', () => {
  it('records every sent message in order', async () => {
    const kafka = createInMemoryKafkaProducer();
    await kafka.send({ topic: 't', key: 'k1', headers: { a: '1' }, value: 'v1' });
    await kafka.send({ topic: 't', key: 'k1', headers: { a: '2' }, value: 'v2' });
    expect(kafka.sent.map((m) => m.value)).toEqual(['v1', 'v2']);
    expect(kafka.sent[0]!.headers.a).toBe('1');
  });

  it('supports failNext() to simulate transient Kafka outage', async () => {
    const kafka = createInMemoryKafkaProducer();
    kafka.failNext(2, new Error('kafka down'));
    await expect(kafka.send({ topic: 't', key: 'k', headers: {}, value: 'v1' }))
      .rejects.toThrow(/kafka down/);
    await expect(kafka.send({ topic: 't', key: 'k', headers: {}, value: 'v1' }))
      .rejects.toThrow(/kafka down/);
    await kafka.send({ topic: 't', key: 'k', headers: {}, value: 'v1' });
    expect(kafka.sent.map((m) => m.value)).toEqual(['v1']);
  });
});
