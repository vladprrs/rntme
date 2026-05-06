import { fromCloudEventWire, type KafkaMessage } from '@rntme/event-store';
import type { ConsumedMessage, KafkaBatch, KafkaConsumer } from '@rntme/projection-consumer';
import type { EventBus } from './interfaces.js';
import type { KafkaJsClientConfig } from '../start/runtime-env.js';
import { RuntimeBootError } from '../start/runtime-env.js';

type KafkaJsProducer = {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  send(input: {
    topic: string;
    messages: readonly {
      key: string;
      value: string;
      headers: Readonly<Record<string, string>>;
    }[];
  }): Promise<unknown>;
};

type KafkaJsMessage = {
  offset: string;
  key: Buffer | string | null;
  value: Buffer | string | null;
  headers?: Readonly<Record<string, Buffer | string | undefined>>;
};

type KafkaJsBatch = {
  topic: string;
  partition: number;
  messages: readonly KafkaJsMessage[];
};

type KafkaJsConsumer = {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  subscribe(input: { topic: string | RegExp; fromBeginning: boolean }): Promise<void>;
  run(input: {
    eachBatch: (input: {
      batch: KafkaJsBatch;
      heartbeat: () => Promise<void>;
    }) => Promise<void>;
  }): Promise<void>;
  commitOffsets(offsets: readonly { topic: string; partition: number; offset: string }[]): Promise<void>;
};

type KafkaJsAdmin = {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  createTopics(input: {
    topics: readonly { topic: string }[];
    waitForLeaders?: boolean;
  }): Promise<boolean>;
};

type KafkaJsClient = {
  producer(): KafkaJsProducer;
  consumer(input: { groupId: string }): KafkaJsConsumer;
  admin(): KafkaJsAdmin;
};

type KafkaJsModule = {
  Kafka: new (config: KafkaJsClientConfig) => KafkaJsClient;
};

export class KafkaJsEventBus implements EventBus {
  private client: KafkaJsClient | null = null;
  private producerClient: KafkaJsProducer | null = null;
  private readonly consumers = new Set<KafkaJsConsumerAdapter>();

  constructor(private readonly config: KafkaJsClientConfig) {}

  async start(): Promise<void> {
    if (this.client !== null) return;
    const { Kafka } = await loadKafkaJs();
    this.client = new Kafka(this.config);
    this.producerClient = this.client.producer();
    await this.producerClient.connect();
  }

  async stop(): Promise<void> {
    for (const consumer of this.consumers) consumer.stop();
    await Promise.all([...this.consumers].map((consumer) => consumer.disconnect()));
    this.consumers.clear();
    if (this.producerClient !== null) {
      await this.producerClient.disconnect();
      this.producerClient = null;
    }
    this.client = null;
  }

  producer(): ReturnType<EventBus['producer']> {
    return {
      send: async (message: KafkaMessage): Promise<void> => {
        const producer = this.producerClient;
        if (producer === null) {
          throw new RuntimeBootError(
            'RUNTIME_BOOT_KAFKAJS_UNAVAILABLE',
            'KafkaJS event bus has not been started',
          );
        }
        await producer.send({
          topic: message.topic,
          messages: [
            {
              key: message.key,
              value: message.value,
              headers: message.headers,
            },
          ],
        });
      },
    };
  }

  async ensureTopics(topics: readonly string[]): Promise<void> {
    if (topics.length === 0) return;
    const client = this.client;
    if (client === null) {
      throw new RuntimeBootError(
        'RUNTIME_BOOT_KAFKAJS_UNAVAILABLE',
        'KafkaJS event bus has not been started',
      );
    }
    const admin = client.admin();
    await admin.connect();
    try {
      await admin.createTopics({
        topics: [...new Set(topics)].sort().map((topic) => ({ topic })),
        waitForLeaders: true,
      });
    } finally {
      await admin.disconnect();
    }
  }

  consumer(opts: { groupId: string; topic: string }): KafkaConsumer {
    if (this.client === null) {
      throw new RuntimeBootError(
        'RUNTIME_BOOT_KAFKAJS_UNAVAILABLE',
        'KafkaJS event bus has not been started',
      );
    }
    const consumer = new KafkaJsConsumerAdapter(this.client.consumer({ groupId: opts.groupId }), opts.topic);
    this.consumers.add(consumer);
    return consumer;
  }
}

class KafkaJsConsumerAdapter implements KafkaConsumer {
  private started = false;
  private stopped = false;
  private readonly batches: KafkaBatch[] = [];
  private readonly waiters: ((batch: KafkaBatch | null) => void)[] = [];

  constructor(
    private readonly consumer: KafkaJsConsumer,
    private readonly topic: string,
  ) {}

  async *[Symbol.asyncIterator](): AsyncIterator<KafkaBatch> {
    await this.ensureStarted();
    while (!this.stopped) {
      const batch = await this.nextBatch();
      if (batch === null) return;
      yield batch;
    }
  }

  async commitOffsets(batch: KafkaBatch): Promise<void> {
    await this.consumer.commitOffsets(
      batch.messages.map((message) => ({
        topic: message.topic,
        partition: message.partition,
        offset: nextOffset(message.offset),
      })),
    );
  }

  stop(): void {
    this.stopped = true;
    for (const waiter of this.waiters.splice(0)) waiter(null);
  }

  async disconnect(): Promise<void> {
    this.stop();
    if (this.started) await this.consumer.disconnect();
  }

  private async ensureStarted(): Promise<void> {
    if (this.started) return;
    this.started = true;
    await this.consumer.connect();
    await this.consumer.subscribe({ topic: toKafkaJsSubscriptionTopic(this.topic), fromBeginning: false });
    void this.consumer.run({
      eachBatch: async ({ batch, heartbeat }) => {
        this.pushBatch({
          messages: batch.messages.map((message) => toConsumedMessage(batch, message)),
        });
        await heartbeat();
      },
    });
  }

  private pushBatch(batch: KafkaBatch): void {
    const waiter = this.waiters.shift();
    if (waiter !== undefined) {
      waiter(batch);
      return;
    }
    this.batches.push(batch);
  }

  private nextBatch(): Promise<KafkaBatch | null> {
    const batch = this.batches.shift();
    if (batch !== undefined) return Promise.resolve(batch);
    if (this.stopped) return Promise.resolve(null);
    return new Promise((resolve) => {
      this.waiters.push(resolve);
    });
  }
}

export function toKafkaJsSubscriptionTopic(topic: string): string | RegExp {
  if (!topic.includes('*')) return topic;
  const pattern = topic
    .split('*')
    .map((part) => part.replace(/[\\^$+?.()|[\]{}]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${pattern}$`);
}

async function loadKafkaJs(): Promise<KafkaJsModule> {
  try {
    return (await import('kafkajs')) as unknown as KafkaJsModule;
  } catch {
    throw new RuntimeBootError(
      'RUNTIME_BOOT_KAFKAJS_UNAVAILABLE',
      'KafkaJS is required when RNTME_EVENT_BUS_BROKERS is set',
    );
  }
}

function toConsumedMessage(batch: KafkaJsBatch, message: KafkaJsMessage): ConsumedMessage {
  const wire = {
    topic: batch.topic,
    key: bufferToString(message.key),
    headers: Object.fromEntries(
      Object.entries(message.headers ?? {}).map(([key, value]) => [key, bufferToString(value ?? null)]),
    ),
    value: bufferToString(message.value),
  };
  return {
    topic: batch.topic,
    partition: batch.partition,
    offset: message.offset,
    key: wire.key,
    envelope: fromCloudEventWire(wire),
  };
}

function bufferToString(value: Buffer | string | null): string {
  if (typeof value === 'string') return value;
  if (value === null) return '';
  return value.toString('utf8');
}

function nextOffset(offset: string): string {
  return (BigInt(offset) + 1n).toString();
}
