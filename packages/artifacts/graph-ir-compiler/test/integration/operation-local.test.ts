import { openSqliteDatabase } from '@rntme/sqlite';
import { describe, expect, it } from 'bun:test';
import { SqliteEventStore } from '@rntme/event-store';
import { compileOperation, executeOperation, type OperationRegistry } from '../../src/index.js';

const registry: OperationRegistry = { resolve: () => null };

const pdm = {
  entities: {
    StockReservation: {
      ownerService: 'inventory',
      kind: 'owned',
      table: 'stock_reservations',
      fields: {
        id: { type: 'string', nullable: false, column: 'id' },
        sku: { type: 'string', nullable: false, column: 'sku' },
        quantity: { type: 'integer', nullable: false, column: 'quantity' },
        reason: { type: 'string', nullable: true, column: 'reason' },
        status: { type: 'string', nullable: false, column: 'status' },
      },
      relations: {},
      keys: ['id'],
      stateMachine: {
        stateField: 'status',
        initial: null,
        states: ['reserved', 'rejected'],
        transitions: {
          reserve: {
            from: null,
            to: 'reserved',
            affects: ['sku', 'quantity'],
            eventType: 'StockReserved',
          },
          rejected: {
            from: null,
            to: 'rejected',
            affects: ['sku', 'quantity', 'reason'],
            eventType: 'StockReservationRejected',
          },
        },
      },
    },
  },
};

const qsm = {
  projections: {
    InventoryItemView: {
      backing: 'entity-mirror',
      source: { entity: 'StockReservation' },
      keys: ['id'],
      grain: ['id'],
      exposed: ['sku', 'quantity'],
      table: 'inventory_items',
    },
  },
  relations: {},
};

const graph = {
  version: '1.0-rc7',
  pdmRef: 'inventory',
  qsmRef: 'inventory.read',
  shapes: {
    ReservationResult: {
      fields: {
        reserved: { type: 'boolean', nullable: false },
        reservationId: { type: 'string', nullable: true },
        reason: { type: 'string', nullable: true },
      },
    },
  },
  graphs: {
    reserveStock: {
      id: 'reserveStock',
      signature: {
        inputs: {
          reservationId: { type: 'string', mode: 'required' },
          sku: { type: 'string', mode: 'required' },
          quantity: { type: 'integer', mode: 'required' },
        },
        output: { type: 'row<ReservationResult>', from: 'out' },
      },
      nodes: [
        {
          id: 'item',
          type: 'findOne',
          config: {
            source: { projection: 'InventoryItemView' },
            where: { eq: ['inventoryItemView.sku', { $param: 'sku' }] },
          },
        },
        {
          id: 'decision',
          type: 'branch',
          cases: [
            { when: { gte: [{ $ref: 'item.quantity' }, { $param: 'quantity' }] }, then: 'emitReserved' },
            { default: true, then: 'emitRejected' },
          ],
        },
        {
          id: 'emitReserved',
          type: 'emit',
          config: {
            aggregate: 'StockReservation',
            aggregateId: { $param: 'reservationId' },
            transition: 'reserve',
            payload: { sku: { $param: 'sku' }, quantity: { $param: 'quantity' } },
          },
        },
        {
          id: 'emitRejected',
          type: 'emit',
          config: {
            aggregate: 'StockReservation',
            aggregateId: { $param: 'reservationId' },
            transition: 'rejected',
            payload: {
              sku: { $param: 'sku' },
              quantity: { $param: 'quantity' },
              reason: { $literal: 'insufficient stock' },
            },
          },
        },
        {
          id: 'out',
          type: 'result',
          value: {
            reserved: { $ref: 'emitReserved.didRun' },
            reservationId: { $ref: 'emitReserved.aggregateId' },
            reason: { $ref: 'emitRejected.payload.after.reason' },
          },
        },
      ],
    },
  },
};

describe('effect operation local execution', () => {
  it('branches to reserved or rejected and returns typed output', async () => {
    const compiled = compileOperation(graph, pdm, qsm, {
      registry,
      serviceName: 'inventory',
      ownedAggregates: new Set(['StockReservation']),
      exposure: 'action',
    });
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;

    const db = openSqliteDatabase({ filename: ':memory:' });
    db.exec('CREATE TABLE inventory_items (sku TEXT PRIMARY KEY, quantity INTEGER NOT NULL)');
    db.prepare('INSERT INTO inventory_items (sku, quantity) VALUES (?, ?)').run('sku-ok', 5);
    db.prepare('INSERT INTO inventory_items (sku, quantity) VALUES (?, ?)').run('missing-stock', 0);
    const eventStore = new SqliteEventStore({ filename: ':memory:', serviceName: 'inventory' });
    let seq = 0;

    const ok = await executeOperation(
      compiled.value,
      {
        reservationId: 'reservation-1',
        sku: 'sku-ok',
        quantity: 1,
      },
      {
        qsmDb: db,
        eventStore,
        callClient: null,
        now: () => '2026-05-06T00:00:00.000Z',
        nextId: () => `event-${++seq}`,
        actor: null,
        correlation: { commandId: 'cmd-1', correlationId: 'corr-1', traceparent: null },
        idempotencyKey: 'idem-1',
      },
    );

    expect(ok.value).toMatchObject({ reserved: true, reservationId: 'reservation-1' });

    const rejected = await executeOperation(
      compiled.value,
      {
        reservationId: 'reservation-2',
        sku: 'missing-stock',
        quantity: 1,
      },
      {
        qsmDb: db,
        eventStore,
        callClient: null,
        now: () => '2026-05-06T00:00:00.000Z',
        nextId: () => `event-${++seq}`,
        actor: null,
        correlation: { commandId: 'cmd-2', correlationId: 'corr-2', traceparent: null },
        idempotencyKey: 'idem-2',
      },
    );

    expect(rejected.value).toMatchObject({ reserved: false, reason: 'insufficient stock' });
  });
});
