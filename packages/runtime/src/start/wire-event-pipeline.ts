import { randomUUID } from 'node:crypto';
import {
  SqliteEventStore,
  createRelay,
  type EventStore,
  type Relay,
} from '@rntme/event-store';
import {
  bootstrapProjections,
  createProjectionConsumer,
  type ProjectionConsumer,
} from '@rntme/projection-consumer';
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

export function wireEventPipeline(
  service: ValidatedService,
  db: DbDriver,
  bus: EventBus,
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
    now: () => new Date().toISOString(),
    nextId: () => randomUUID(),
  });

  const projectionConsumer = createProjectionConsumer({
    kafka: bus.consumer({
      groupId: `${serviceName}:projection`,
      topic: serviceName,
    }),
    plan: service.projectionApplyPlan,
    db: qsmDb,
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
