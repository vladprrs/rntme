import type { KafkaMessage, KafkaProducer, EventEnvelope } from '@rntme/event-store';
import {
  createInMemoryKafkaConsumer,
  type InMemoryKafkaConsumer,
  type KafkaConsumer,
} from '@rntme/projection-consumer';
import type { EventBus } from './interfaces.js';

export class InMemoryBus implements EventBus {
  private readonly inner: InMemoryKafkaConsumer;

  constructor(opts: { pollIntervalMs?: number } = {}) {
    this.inner = createInMemoryKafkaConsumer({ pollIntervalMs: opts.pollIntervalMs ?? 2 });
  }

  producer(): KafkaProducer {
    const inner = this.inner;
    return {
      async send(message: KafkaMessage): Promise<void> {
        const envelope = JSON.parse(message.value) as EventEnvelope;
        inner.produce(envelope);
      },
    };
  }

  consumer(): KafkaConsumer {
    return this.inner;
  }
}
