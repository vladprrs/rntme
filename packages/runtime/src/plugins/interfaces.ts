import type { Hono, Context } from 'hono';
import type BetterSqlite3 from 'better-sqlite3';
import type { EventStore, KafkaProducer, ActorRef } from '@rntme/event-store';
import type { KafkaConsumer } from '@rntme/projection-consumer';
import type { ValidatedService } from '../types.js';

/** Narrow slice of better-sqlite3 used by event-store + projection-consumer + graph-ir-compiler. */
export type DbHandle = BetterSqlite3.Database;

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
  start?(): Promise<void>;
  stop?(): Promise<void>;
}

export type SurfaceContext = {
  service: ValidatedService;
  eventStore: EventStore;
  qsmDb: DbHandle;
  actorFromRequest: (c: Context) => ActorRef | null;
};

export interface Surface {
  mount(app: Hono, ctx: SurfaceContext): void;
  listen?(): Promise<{ port: number; stop(): Promise<void> }>;
}
