import type { KafkaMessage, KafkaProducer } from '@rntme/event-store';
import { fromCloudEventWire } from '@rntme/event-store';
import type { ConsumedMessage, KafkaBatch, KafkaConsumer } from '@rntme/projection-consumer';
import type { EventBus } from './interfaces.js';

type BusConsumer = KafkaConsumer & {
  readonly stopped: boolean;
};

type ConsumerEntry = {
  topic: string;
  cursor: number;
  stopped: boolean;
};

function topicPatternMatches(pattern: string, topic: string): boolean {
  if (pattern === topic) return true;
  if (!pattern.includes('*')) return false;

  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`).test(topic);
}

function createTopicConsumer(opts: {
  pollIntervalMs: number;
  entry: ConsumerEntry;
  messages: () => readonly ConsumedMessage[];
}): BusConsumer {
  async function* iterate(): AsyncGenerator<KafkaBatch> {
    while (!opts.entry.stopped) {
      const batchMessages: ConsumedMessage[] = [];
      const messages = opts.messages();

      while (opts.entry.cursor < messages.length) {
        const message = messages[opts.entry.cursor++]!;
        if (topicPatternMatches(opts.entry.topic, message.topic)) {
          batchMessages.push(message);
        }
      }

      if (batchMessages.length === 0) {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, opts.pollIntervalMs);
        });
        continue;
      }

      yield { messages: batchMessages };
    }
  }

  const consumer: BusConsumer = {
    get stopped(): boolean {
      return opts.entry.stopped;
    },
    stop(): void {
      opts.entry.stopped = true;
    },
    async commitOffsets(_batch: KafkaBatch): Promise<void> {
      // The in-process bus has no durable offset store; commit is a contract no-op.
    },
    [Symbol.asyncIterator](): AsyncIterator<KafkaBatch> {
      return iterate();
    },
  };

  return consumer;
}

export class InMemoryBus implements EventBus {
  private readonly pollIntervalMs: number;
  private readonly messages: ConsumedMessage[] = [];
  private nextOffset = 0;

  constructor(opts: { pollIntervalMs?: number } = {}) {
    this.pollIntervalMs = opts.pollIntervalMs ?? 2;
  }

  producer(): KafkaProducer {
    return {
      send: async (message: KafkaMessage): Promise<void> => {
        const envelope = fromCloudEventWire(message);
        const consumed: ConsumedMessage = {
          topic: message.topic,
          partition: 0,
          offset: String(this.nextOffset++),
          key: message.key,
          envelope,
        };

        this.messages.push(consumed);
      },
    };
  }

  consumer(opts: { groupId: string; topic: string }): KafkaConsumer {
    const entry: ConsumerEntry = { topic: opts.topic, cursor: 0, stopped: false };
    const consumer = createTopicConsumer({
      pollIntervalMs: this.pollIntervalMs,
      entry,
      messages: () => this.messages,
    });
    return consumer;
  }
}
