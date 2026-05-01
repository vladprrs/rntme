import { defaultTopicOf, type EventEnvelope } from '@rntme/event-store';
import type { ConsumedMessage, KafkaBatch, KafkaConsumer } from '../types/consumer.js';

// Source format: `rntme://${serviceName}/${rntAggregateType}` — see spec §3.1.
// Splitting on '/' yields ['rntme:', '', serviceName, rntAggregateType].
function serviceNameFromSource(source: string): string {
  const segs = source.split('/');
  if (segs.length < 4 || segs[0] !== 'rntme:' || segs[1] !== '' || segs[2] === '') {
    throw new Error(`PROJECTION_CONSUMER_INVALID_SOURCE: cannot extract serviceName from ${source}`);
  }
  return segs[2]!;
}

function canonicalTopicOf(envelope: EventEnvelope): string {
  return defaultTopicOf(serviceNameFromSource(envelope.source), envelope.rntAggregateType);
}

export type InMemoryKafkaConsumer = KafkaConsumer &
  Readonly<{
    produce(envelope: EventEnvelope): void;
    stop(): void;
    readonly committed: readonly ConsumedMessage[];
  }>;

export function createInMemoryKafkaConsumer(
  options: { topicOf?: (envelope: EventEnvelope) => string; pollIntervalMs?: number } = {},
): InMemoryKafkaConsumer {
  const topicOf = options.topicOf ?? canonicalTopicOf;
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
        topic: topicOf(envelope),
        partition: 0,
        offset: String(nextOffset++),
        key: envelope.subject,
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
