import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { toCloudEventWire, type EventEnvelope } from '@rntme/event-store';
import type { DbDriver, EventBus, Surface, SurfaceContext } from './interfaces.js';

export function runDbDriverContract(driver: DbDriver): void {
  describe('DbDriver contract', () => {
    it('opens :memory: and executes DDL', () => {
      const db = driver.open({ purpose: 'qsm', path: ':memory:' });
      db.exec('CREATE TABLE t (a INTEGER)');
      const stmt = db.prepare('INSERT INTO t VALUES (?)');
      stmt.run(1);
      const rows = db.prepare('SELECT a FROM t').all() as { a: number }[];
      expect(rows).toEqual([{ a: 1 }]);
      db.close();
    });

    it('supports transactions', () => {
      const db = driver.open({ purpose: 'qsm', path: ':memory:' });
      db.exec('CREATE TABLE t (a INTEGER)');
      const insert = db.prepare('INSERT INTO t VALUES (?)');
      const tx = db.transaction((vals: number[]) => {
        for (const v of vals) insert.run(v);
      });
      tx([1, 2, 3]);
      const rows = db.prepare('SELECT COUNT(*) AS n FROM t').get() as { n: number };
      expect(rows.n).toBe(3);
      db.close();
    });
  });
}

export function runEventBusContract(makeBus: () => EventBus): void {
  describe('EventBus contract', () => {
    it('producer() and consumer() do not throw', () => {
      const bus = makeBus();
      expect(() => bus.producer()).not.toThrow();
      expect(() => bus.consumer({ groupId: 'g', topic: 't' })).not.toThrow();
    });

    it('delivers produced messages to a consumer', async () => {
      const bus = makeBus();
      const producer = bus.producer();
      const consumer = bus.consumer({ groupId: 'g', topic: 't' });
      const received: unknown[] = [];

      const envelope: EventEnvelope = {
        id: 'e1',
        source: 'rntme://test-svc/A',
        eventType: 'Noop',
        type: 'test-svc.A.Noop',
        time: new Date().toISOString(),
        subject: 'A-1',
        dataContentType: 'application/json',
        dataSchema: 'rntme://schemas/test-svc/Noop.v1.json',
        data: {},
        correlationId: 'corr-1',
        causationId: null,
        commandId: null,
        rntAggregateType: 'A',
        rntAggregateId: '1',
        rntVersion: 1,
        rntSchemaVersion: 1,
        rntActorKind: null,
        rntActorId: null,
        traceparent: null,
      };

      // Produce first so it's in the queue before the iterator starts polling.
      // Build a CE binary-mode KafkaMessage — InMemoryBus decodes via
      // fromCloudEventWire to stay contract-equivalent with real Kafka.
      await producer.send(toCloudEventWire(envelope, 't'));

      // Consume: iterate, collect one message, then stop
      for await (const batch of consumer) {
        for (const m of batch.messages) {
          received.push(m.envelope);
        }
        await consumer.commitOffsets(batch);
        // Stop after first non-empty batch
        if (received.length >= 1) {
          consumer.stop?.();
          break;
        }
      }

      expect(received.length).toBe(1);
    }, 5000);
  });
}

export function runSurfaceContract(makeSurface: () => Surface): void {
  describe('Surface contract', () => {
    it('mounts onto a Hono app without throwing', () => {
      const surface = makeSurface();
      const app = new Hono();
      const ctx = {
        service: {} as SurfaceContext['service'],
        eventStore: {} as SurfaceContext['eventStore'],
        qsmDb: {} as SurfaceContext['qsmDb'],
        actorFromRequest: () => null,
      } as SurfaceContext;
      expect(() => surface.mount(app, ctx)).not.toThrow();
    });
  });
}

import type {
  CommandExecutor,
  QueryExecutor,
  CommandExecutionContext,
} from './executors/types.js';
import { SqliteEventStore } from '@rntme/event-store';
import BetterSqlite3 from 'better-sqlite3';

function makeCommandCtx(): CommandExecutionContext {
  return {
    eventStore: new SqliteEventStore({ filename: ':memory:', serviceName: 'contract' }),
    qsmDb: null,
    now: () => '2026-04-19T00:00:00.000Z',
    nextId: () => 'id-1',
    actor: null,
    correlation: { commandId: 'cmd-1', correlationId: 'corr-1', traceparent: null },
  };
}

export function runCommandExecutorContract(
  label: string,
  makeExecutor: () => CommandExecutor,
): void {
  describe(`CommandExecutor contract — ${label}`, () => {
    it('execute returns ok for a known command', async () => {
      const executor = makeExecutor();
      const out = await executor.execute({
        commandName: 'contractEcho',
        inputs: { id: 'X' },
        ctx: makeCommandCtx(),
      });
      expect(out.ok).toBe(true);
    });

    it('execute returns COMMAND_NOT_FOUND for unknown command', async () => {
      const executor = makeExecutor();
      const out = await executor.execute({
        commandName: '__definitely_not_registered__',
        inputs: {},
        ctx: makeCommandCtx(),
      });
      expect(out.ok).toBe(false);
      if (!out.ok) expect(out.error.code).toBe('COMMAND_NOT_FOUND');
    });
  });
}

export function runQueryExecutorContract(
  label: string,
  makeExecutor: () => QueryExecutor,
): void {
  describe(`QueryExecutor contract — ${label}`, () => {
    it('execute returns ok for a known query', async () => {
      const executor = makeExecutor();
      const db = new BetterSqlite3(':memory:');
      const out = await executor.execute({
        queryName: 'contractNoop',
        inputs: {},
        ctx: { qsmDb: db },
      });
      expect(out.ok).toBe(true);
      db.close();
    });

    it('execute returns QUERY_NOT_FOUND for unknown query', async () => {
      const executor = makeExecutor();
      const db = new BetterSqlite3(':memory:');
      const out = await executor.execute({
        queryName: '__nope__',
        inputs: {},
        ctx: { qsmDb: db },
      });
      expect(out.ok).toBe(false);
      if (!out.ok) expect(out.error.code).toBe('QUERY_NOT_FOUND');
      db.close();
    });
  });
}

import type { GrpcSurface } from './grpc-surface.js';

export function runGrpcSurfaceContract(makeSurface: () => GrpcSurface): void {
  describe('GrpcSurface contract', () => {
    it('mount is a no-op and does not throw', () => {
      const surface = makeSurface();
      expect(() => surface.mount(/* unused */ {} as Hono, {} as SurfaceContext)).not.toThrow();
    });
  });
}
