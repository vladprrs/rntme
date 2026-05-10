import { describe, expect, it } from 'bun:test';
import {
  compileOperation,
  compileOperationFromValidated,
  parseAuthoringSpec,
  type OperationRegistry,
} from '../../src/index.js';
import { loadValidatedPdmAndQsm } from '../load-validated.js';

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

const opts = {
  registry,
  serviceName: 'inventory',
  ownedAggregates: new Set(['StockReservation']),
  exposure: 'action' as const,
};

describe('compileOperationFromValidated', () => {
  it('produces output equivalent to compileOperation when given pre-validated artifacts', () => {
    const fromRaw = compileOperation(graph, pdm, qsm, opts);
    expect(fromRaw.ok).toBe(true);
    if (!fromRaw.ok) return;

    const parsedSpec = parseAuthoringSpec(graph);
    expect(parsedSpec.ok).toBe(true);
    if (!parsedSpec.ok) return;
    const validated = loadValidatedPdmAndQsm(pdm, qsm);

    const fromValidated = compileOperationFromValidated(
      parsedSpec.value,
      validated.pdm,
      validated.qsm,
      opts,
    );
    expect(fromValidated.ok).toBe(true);
    if (!fromValidated.ok) return;

    expect(fromValidated.value.graphId).toBe(fromRaw.value.graphId);
    expect(fromValidated.value.resultNodeId).toBe(fromRaw.value.resultNodeId);
    expect(fromValidated.value.graph).toEqual(fromRaw.value.graph);
    expect(fromValidated.value.effects).toEqual(fromRaw.value.effects);
    expect(fromValidated.value.registryEntriesByNodeId).toEqual(
      fromRaw.value.registryEntriesByNodeId,
    );
    // Validated artifacts come from the same parse-and-validate pipeline,
    // so structural identity holds.
    expect(fromValidated.value.pdm).toBe(validated.pdm);
    expect(fromValidated.value.qsm).toBe(validated.qsm);
  });
});
