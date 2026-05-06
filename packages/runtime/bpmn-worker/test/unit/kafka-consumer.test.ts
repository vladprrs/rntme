import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import { toCloudEventWire, type EventEnvelope } from '@rntme/event-store';
import { decodeKafkaJsMessage } from '../../src/kafka-consumer.js';

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
