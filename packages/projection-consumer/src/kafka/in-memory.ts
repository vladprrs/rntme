import type { EventEnvelope } from '@rntme/event-store';
import type { ConsumedMessage, KafkaBatch, KafkaConsumer } from '../types/consumer.js';

export type InMemoryKafkaConsumer = KafkaConsumer & {
  readonly committed: readonly KafkaBatch[];
  produce(opts: { topic: string; partition: number; envelope: EventEnvelope }): void;
  stop(): void;
};

export function createInMemoryKafkaConsumer(opts?: {
  pollIntervalMs?: number;
}): InMemoryKafkaConsumer {
  const pollIntervalMs = opts?.pollIntervalMs ?? 50;
  const queue: ConsumedMessage[] = [];
  const committed: KafkaBatch[] = [];
  let stopped = false;
  let offsetSeq = 0;

  const sleep = (): Promise<void> =>
    new Promise((resolve) => {
      setTimeout(resolve, pollIntervalMs);
    });

  const consumer: InMemoryKafkaConsumer = {
    get committed(): readonly KafkaBatch[] {
      return committed;
    },
    produce(opts: { topic: string; partition: number; envelope: EventEnvelope }): void {
      const offset = String(offsetSeq++);
      queue.push({
        topic: opts.topic,
        partition: opts.partition,
        offset,
        key: opts.envelope.stream,
        envelope: opts.envelope,
      });
    },
    stop(): void {
      stopped = true;
    },
    async commitOffsets(batch: KafkaBatch): Promise<void> {
      committed.push(batch);
    },
    [Symbol.asyncIterator](): AsyncIterator<KafkaBatch> {
      return {
        async next(): Promise<IteratorResult<KafkaBatch>> {
          if (stopped) {
            return { done: true, value: undefined };
          }
          await sleep();
          if (stopped) {
            return { done: true, value: undefined };
          }
          const messages = queue.splice(0, queue.length);
          return { done: false, value: { messages } };
        },
      };
    },
  };

  return consumer;
}
