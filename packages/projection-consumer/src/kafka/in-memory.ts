import type { EventEnvelope } from '@rntme/event-store';
import type { ConsumedMessage, KafkaBatch, KafkaConsumer } from '../types/consumer.js';

function defaultTopicOf(aggregateType: string): string {
  return `rntme.${aggregateType.toLowerCase()}.v1`;
}

export type InMemoryKafkaConsumer = KafkaConsumer &
  Readonly<{
    produce(envelope: EventEnvelope): void;
    stop(): void;
    readonly committed: readonly ConsumedMessage[];
  }>;

export function createInMemoryKafkaConsumer(
  options: { topicOf?: (aggregateType: string) => string; pollIntervalMs?: number } = {},
): InMemoryKafkaConsumer {
  const topicOf = options.topicOf ?? defaultTopicOf;
  const pollIntervalMs = options.pollIntervalMs ?? 2;
  const queue: ConsumedMessage[] = [];
  const committed: ConsumedMessage[] = [];
  let stopped = false;
  let nextOffset = 0;

  async function* iterate(): AsyncGenerator<KafkaBatch> {
    while (!stopped) {
      if (queue.length === 0) {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, pollIntervalMs);
        });
        continue;
      }
      const messages = queue.splice(0, queue.length);
      yield { messages };
    }
  }

  const consumer: InMemoryKafkaConsumer = {
    get committed(): readonly ConsumedMessage[] {
      return committed;
    },
    produce(envelope: EventEnvelope): void {
      queue.push({
        topic: topicOf(envelope.aggregateType),
        partition: 0,
        offset: String(nextOffset++),
        key: envelope.stream,
        envelope,
      });
    },
    stop(): void {
      stopped = true;
    },
    async commitOffsets(batch: KafkaBatch): Promise<void> {
      committed.push(...batch.messages);
    },
    [Symbol.asyncIterator](): AsyncIterator<KafkaBatch> {
      return iterate();
    },
  };

  return consumer;
}
