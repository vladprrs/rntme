export const VERSION = '0.0.0';

// Types
export type { ActorRef } from './types/actor.js';
export type { EventEnvelope } from './types/envelope.js';
export type {
  AppendEventInput,
  AppendRequest,
  AppendResult,
  AppendedEvent,
} from './types/append.js';
export {
  EventStoreError,
  ConcurrencyConflict,
  DuplicateEventId,
} from './types/errors.js';
export type { EventStoreErrorCode } from './types/errors.js';

// Store
export type {
  EventStore,
  ReadFromOptions,
  EventRecord,
} from './store/interface.js';
export {
  SqliteEventStore,
  mapSqliteError,
} from './store/sqlite.js';
export type { SqliteEventStoreOptions } from './store/sqlite.js';
export { applyEventStoreSchema } from './store/schema.js';
export { rowToEnvelope } from './store/row-mapper.js';
export type { EventLogRow } from './store/row-mapper.js';

// Kafka
export type { KafkaMessage, KafkaProducer } from './kafka/producer.js';
export {
  createInMemoryKafkaProducer,
} from './kafka/in-memory.js';
export type { InMemoryKafkaProducer } from './kafka/in-memory.js';

// Relay
export { createRelay } from './relay/loop.js';
export type { Relay, RelayOptions } from './relay/loop.js';
export { defaultTopicOf } from './relay/topic.js';
