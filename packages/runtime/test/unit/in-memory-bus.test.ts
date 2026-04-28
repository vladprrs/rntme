import { toCloudEventWire, type EventEnvelope } from '@rntme/event-store';
import type { ConsumedMessage } from '@rntme/projection-consumer';
import { describe, expect, it } from 'vitest';
import { InMemoryBus } from '../../src/plugins/in-memory-bus.js';

function envelope(overrides: Partial<EventEnvelope>): EventEnvelope {
  return {
    id: 'e1',
    source: 'rntme://alpha/Issue',
    eventType: 'Created',
    type: 'alpha.Issue.Created',
    time: new Date().toISOString(),
    subject: 'Issue-1',
    dataContentType: 'application/json',
    dataSchema: 'rntme://schemas/alpha/Created.v1.json',
    data: {},
    correlationId: 'corr-1',
    causationId: null,
    commandId: null,
    rntAggregateType: 'Issue',
    rntAggregateId: '1',
    rntVersion: 1,
    rntSchemaVersion: 1,
    rntActorKind: null,
    rntActorId: null,
    traceparent: null,
    ...overrides,
  };
}

describe('InMemoryBus', () => {
  it('retains produced messages until a matching consumer is created', async () => {
    const bus = new InMemoryBus();
    const producer = bus.producer();

    await producer.send(toCloudEventWire(envelope({ id: 'alpha-1' }), 'rntme.alpha.issue'));

    const consumer = bus.consumer({
      groupId: 'alpha:projection',
      topic: 'rntme.alpha.issue',
    });
    const iterator = consumer[Symbol.asyncIterator]();
    const first = await iterator.next();
    consumer.stop?.();

    expect(first.done).toBe(false);
    expect(first.value?.messages.map((m: ConsumedMessage) => m.envelope.id)).toEqual([
      'alpha-1',
    ]);
  });

  it('delivers only messages matching the consumer topic pattern', async () => {
    const bus = new InMemoryBus();
    const producer = bus.producer();
    const alphaConsumer = bus.consumer({
      groupId: 'alpha:projection',
      topic: 'rntme.alpha.*',
    });

    await producer.send(
      toCloudEventWire(
        envelope({
          id: 'beta-1',
          source: 'rntme://beta/Issue',
          type: 'beta.Issue.Created',
          dataSchema: 'rntme://schemas/beta/Created.v1.json',
        }),
        'rntme.beta.issue',
      ),
    );
    await producer.send(
      toCloudEventWire(
        envelope({
          id: 'alpha-1',
          source: 'rntme://alpha/Issue',
          type: 'alpha.Issue.Created',
          dataSchema: 'rntme://schemas/alpha/Created.v1.json',
        }),
        'rntme.alpha.issue',
      ),
    );

    const iterator = alphaConsumer[Symbol.asyncIterator]();
    const first = await iterator.next();
    alphaConsumer.stop?.();

    expect(first.done).toBe(false);
    expect(first.value?.messages.map((m: ConsumedMessage) => [m.topic, m.envelope.id])).toEqual([
      ['rntme.alpha.issue', 'alpha-1'],
    ]);
  });

  it('does not let one topic consumer discard messages for a later matching consumer', async () => {
    const bus = new InMemoryBus();
    const producer = bus.producer();
    const alphaConsumer = bus.consumer({
      groupId: 'alpha:projection',
      topic: 'rntme.alpha.*',
    });

    await producer.send(
      toCloudEventWire(
        envelope({
          id: 'beta-1',
          source: 'rntme://beta/Issue',
          type: 'beta.Issue.Created',
          dataSchema: 'rntme://schemas/beta/Created.v1.json',
        }),
        'rntme.beta.issue',
      ),
    );

    const alphaIterator = alphaConsumer[Symbol.asyncIterator]();
    const alphaPoll = alphaIterator.next();
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
    alphaConsumer.stop?.();

    const betaConsumer = bus.consumer({
      groupId: 'beta:projection',
      topic: 'rntme.beta.*',
    });
    const betaIterator = betaConsumer[Symbol.asyncIterator]();
    const betaFirst = await betaIterator.next();
    betaConsumer.stop?.();

    await alphaPoll;
    expect(betaFirst.done).toBe(false);
    expect(betaFirst.value?.messages.map((m: ConsumedMessage) => [m.topic, m.envelope.id])).toEqual([
      ['rntme.beta.issue', 'beta-1'],
    ]);
  });
});
