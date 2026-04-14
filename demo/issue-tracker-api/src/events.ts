import type Database from 'better-sqlite3';
import {
  SqliteEventStore,
  createRelay,
  type KafkaMessage,
  type KafkaProducer,
  type Relay,
  type EventEnvelope,
  type EventStore,
} from '@rntme/event-store';
import {
  createProjectionConsumer,
  createInMemoryKafkaConsumer,
  compileApplyPlan,
  type ProjectionConsumer,
  type InMemoryKafkaConsumer,
} from '@rntme/projection-consumer';
import { createSeededDb } from './db/seed.js';
import { pdmResolver, validatedQsm, eventTypes } from './artifacts.js';

export type EventPipeline = {
  eventStore: EventStore;
  qsmDb: Database.Database;
  start(): void;
  stop(): Promise<void>;
};

export function buildEventPipeline(): EventPipeline {
  const qsmDb = createSeededDb();

  const eventStore = new SqliteEventStore({ filename: ':memory:' });

  const consumer: InMemoryKafkaConsumer = createInMemoryKafkaConsumer({ pollIntervalMs: 2 });

  const bridgeProducer: KafkaProducer = {
    async send(message: KafkaMessage): Promise<void> {
      const envelope = JSON.parse(message.value) as EventEnvelope;
      consumer.produce(envelope);
    },
  };

  const relay: Relay = createRelay({
    store: eventStore,
    kafka: bridgeProducer,
    cursorId: 'demo',
    pollIntervalMs: 10,
    batchSize: 100,
  });

  const plan = compileApplyPlan({
    pdm: pdmResolver,
    qsm: validatedQsm,
    events: eventTypes,
  });

  const projectionConsumer: ProjectionConsumer = createProjectionConsumer({
    kafka: consumer,
    plan,
    db: qsmDb,
  });

  return {
    eventStore,
    qsmDb,
    start(): void {
      projectionConsumer.start();
      relay.start();
    },
    async stop(): Promise<void> {
      await relay.stop();
      await projectionConsumer.stop();
      (eventStore as SqliteEventStore).close();
      qsmDb.close();
    },
  };
}
