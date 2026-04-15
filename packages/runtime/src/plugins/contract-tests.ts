import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
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

      const envelope = {
        eventId: 'e1',
        stream: 'a-1',
        aggregateType: 'A',
        version: 1,
        payload: {},
        schemaVersion: 1,
        occurredAt: new Date().toISOString(),
        type: 'Noop',
        actor: null,
      };

      // Produce first so it's in the queue before the iterator starts polling
      await producer.send({
        topic: 't',
        key: 'k',
        headers: {},
        value: JSON.stringify(envelope),
      });

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
