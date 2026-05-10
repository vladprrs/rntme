import { Buffer } from 'node:buffer';
import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { toCloudEventWire, type EventEnvelope } from '@rntme/event-store';
import { createKafkaWorkflowConsumer, decodeKafkaJsMessage } from '../../src/kafka-consumer.js';

const kafkaMock = {
  subscribeCalls: [] as Array<{ topics: string[]; fromBeginning?: boolean }>,
  disconnect: mock(async () => undefined),
};

mock.module('kafkajs', () => ({
  Kafka: class {
    consumer() {
      return {
        connect: mock(async () => undefined),
        subscribe: mock(async (input: { topics: string[]; fromBeginning?: boolean }) => {
          kafkaMock.subscribeCalls.push(input);
        }),
        run: mock(async () => undefined),
        disconnect: kafkaMock.disconnect,
      };
    }
  },
}));

describe('decodeKafkaJsMessage', () => {
  it('decodes KafkaJS buffers through the event-store CloudEvents codec', () => {
    const envelope: EventEnvelope = {
      id: 'evt_1',
      source: 'rntme://services/orders',
      specversion: '1.0',
      eventType: 'OrderPlaced',
      type: 'orders.Order.OrderPlaced.v1',
      subject: 'Order:ord_1',
      time: '2026-05-06T00:00:00.000Z',
      dataContentType: 'application/json',
      dataSchema: 'rntme://schemas/orders/Order/OrderPlaced/v1',
      data: { orderId: 'ord_1' },
      rntAggregateType: 'Order',
      rntAggregateId: 'ord_1',
      rntVersion: 1,
      rntSchemaVersion: 1,
      rntActorKind: 'system',
      rntActorId: 'test',
      correlationId: 'corr_1',
      causationId: null,
      commandId: null,
      traceparent: null,
    } as EventEnvelope;
    const wire = toCloudEventWire(envelope, 'rntme.orders.order');
    const decoded = decodeKafkaJsMessage({
      key: Buffer.from(wire.key),
      value: Buffer.from(wire.value),
      headers: Object.fromEntries(Object.entries(wire.headers).map(([key, value]) => [key, Buffer.from(value)])),
    });

    expect(decoded.id).toBe('evt_1');
    expect(decoded.data).toEqual({ orderId: 'ord_1' });
  });
});

describe('createKafkaWorkflowConsumer', () => {
  beforeEach(() => {
    kafkaMock.subscribeCalls.length = 0;
    kafkaMock.disconnect.mockClear();
  });

  it('subscribes from the beginning so message-start events are not dropped during worker startup', async () => {
    const consumer = await createKafkaWorkflowConsumer({
      brokers: ['redpanda:9092'],
      clientId: 'worker',
      groupId: 'worker-deployment',
      subscriptions: [
        {
          messageStartId: 'orderPlaced',
          topic: 'rntme.preview.orders.order',
          service: 'orders',
          aggregateType: 'Order',
          eventType: 'OrderPlaced',
          processId: 'orderFulfillment',
          messageName: 'OrderPlaced',
          businessKey: '$event.rntAggregateId',
        },
      ],
    });

    expect(kafkaMock.subscribeCalls).toEqual([
      { topics: ['rntme.preview.orders.order'], fromBeginning: true },
    ]);

    await consumer.stop();
    expect(kafkaMock.disconnect).toHaveBeenCalledTimes(1);
  });
});
