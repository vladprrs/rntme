import type { Hono, Context } from 'hono';
import type { SqliteDatabase } from '@rntme/sqlite';
import type { EventStore, KafkaProducer, ActorRef } from '@rntme/event-store';
import type { KafkaConsumer } from '@rntme/projection-consumer';
import type { OperationCallClient, OperationRegistry } from '@rntme/graph-ir-compiler';
import type { ValidatedService } from '../types.js';

/** Narrow SQLite handle used by event-store + projection-consumer + graph-ir-compiler. */
export type DbHandle = SqliteDatabase;

export type DbOpenOpts = {
  purpose: 'event-store' | 'qsm';
  path: string | ':memory:';
};

export interface DbDriver {
  open(opts: DbOpenOpts): DbHandle;
}

export interface EventBus {
  producer(): KafkaProducer;
  consumer(opts: { groupId: string; topic: string }): KafkaConsumer;
  ensureTopics?(topics: readonly string[]): Promise<void>;
  start?(): Promise<void>;
  stop?(): Promise<void>;
}

export type SurfaceContext = {
  service: ValidatedService;
  eventStore: EventStore;
  qsmDb: DbHandle;
  actorFromRequest: (c: Context) => ActorRef | null;
  operationRegistry: OperationRegistry;
  operationCallClient: OperationCallClient | null;
};

export interface Surface {
  mount(app: Hono, ctx: SurfaceContext): Promise<void> | void;
  listen?(ctx?: SurfaceContext): Promise<{ port: number; stop(): Promise<void> }>;
}

export type {
  ExternalAdapterClient,
  AdapterCallOptions,
  AdapterResult,
  AdapterOk,
  AdapterErr,
  AdapterError,
  AdapterErrorCode,
  RetryPolicy,
  RetryStrategy,
} from './adapter-client/types.js';
export { DEFAULT_RETRY, DEFAULT_TIMEOUT_MS } from './adapter-client/types.js';
