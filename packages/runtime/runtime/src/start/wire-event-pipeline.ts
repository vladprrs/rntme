import { randomUUID } from 'node:crypto';
import {
  SqliteEventStore,
  createRelay,
  defaultTopicPatternOf,
  type EventStore,
  type Relay,
} from '@rntme/event-store';
import {
  bootstrapProjections,
  createProjectionConsumer,
  type ProjectionConsumer,
  type KafkaBatch,
} from '@rntme/projection-consumer';
import type { Logger } from 'pino';
import type { DbHandle, DbDriver, EventBus } from '../plugins/interfaces.js';
import type { ValidatedService } from '../types.js';

export type EventPipeline = {
  eventStore: EventStore;
  qsmDb: DbHandle;
  relay: Relay;
  projectionConsumer: ProjectionConsumer;
  start(): void;
  stop(): Promise<void>;
};

export type EventPipelineOptions = {
  topicPrefix?: string | null;
  logger?: Pick<Logger, 'error'>;
};

export function wireEventPipeline(
  service: ValidatedService,
  db: DbDriver,
  bus: EventBus,
  options: EventPipelineOptions = {},
): EventPipeline {
  const manifest = service.manifest;
  const serviceName = manifest.service.name;
  const eventStorePath =
    manifest.persistence.mode === 'persistent'
      ? manifest.persistence.eventStorePath
      : ':memory:';
  const qsmPath =
    manifest.persistence.mode === 'persistent' ? manifest.persistence.qsmPath : ':memory:';

  const eventStore = new SqliteEventStore({
    filename: eventStorePath,
    serviceName,
  });
  const qsmDb = db.open({ purpose: 'qsm', path: qsmPath });

  bootstrapProjections(qsmDb, service.projectionDdls);

  const relay: Relay = createRelay({
    store: eventStore,
    kafka: bus.producer(),
    cursorId: `${serviceName}:relay`,
    pollIntervalMs: 10,
    batchSize: 100,
    serviceName,
    ...(options.topicPrefix === undefined ? {} : { topicPrefix: options.topicPrefix }),
    now: () => new Date().toISOString(),
    nextId: () => randomUUID(),
  });

  const projectionConsumer = createProjectionConsumer({
    kafka: bus.consumer({
      groupId: `${serviceName}:projection`,
      topic: defaultTopicPatternOf(serviceName, options.topicPrefix),
    }),
    plan: service.projectionApplyPlan,
    db: qsmDb,
    onError: (err, batch) => logProjectionConsumerError(options.logger, err, batch),
  });

  return {
    eventStore,
    qsmDb,
    relay,
    projectionConsumer,
    start(): void {
      projectionConsumer.start();
      relay.start();
    },
    async stop(): Promise<void> {
      await relay.stop();
      await projectionConsumer.stop();
      eventStore.close();
      qsmDb.close();
    },
  };
}

function logProjectionConsumerError(
  logger: Pick<Logger, 'error'> | undefined,
  err: unknown,
  batch: KafkaBatch,
): void {
  const eventMetadata = batch.messages.map((message) => ({
    topic: message.topic,
    partition: message.partition,
    offset: message.offset,
    eventId: message.envelope.id,
    eventType: message.envelope.eventType,
    aggregateType: message.envelope.rntAggregateType,
    aggregateId: message.envelope.rntAggregateId,
  }));
  const details = {
    msg: 'projection_consumer_batch_failed',
    err,
    batchSize: batch.messages.length,
    events: eventMetadata,
  };

  if (logger !== undefined) {
    logger.error(details, 'projection consumer batch failed');
    return;
  }

  // eslint-disable-next-line no-console
  console.error('[projection-consumer] batch failed', details);
}
