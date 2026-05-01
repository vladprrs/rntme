export type { ActorRef } from './actor.js';
export type { EventEnvelope } from './envelope.js';
export type {
  AppendEventInput,
  AppendRequest,
  AppendResult,
  AppendedEvent,
} from './append.js';
export {
  EventStoreError,
  ConcurrencyConflict,
  DuplicateEventId,
} from './errors.js';
export type { EventStoreErrorCode } from './errors.js';
