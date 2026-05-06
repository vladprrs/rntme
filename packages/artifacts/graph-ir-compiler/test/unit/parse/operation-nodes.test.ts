import { describe, expect, it } from 'vitest';
import { parseAuthoringSpec } from '../../../src/parse/parse.js';

const base = {
  version: '1.0-rc7',
  pdmRef: 'demo.pdm',
  qsmRef: 'demo.qsm',
  shapes: {
    ReservationResult: {
      fields: {
        reserved: { type: 'boolean', nullable: false },
        reason: { type: 'string', nullable: true },
      },
    },
  },
};

describe('operation nodes parse', () => {
  it('accepts findOne, call, branch, emit, result, and $ref', () => {
    const r = parseAuthoringSpec({
      ...base,
      graphs: {
        reserveStock: {
          id: 'reserveStock',
          signature: {
            inputs: {
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
              id: 'credit',
              type: 'call',
              target: { service: 'customers', operation: 'getCreditStatus' },
              input: { customerId: { $ref: 'item.customerId' } },
              policy: {
                timeoutMs: 500,
                retry: { attempts: 2, retryOn: 'transient' },
                idempotency: { mode: 'inherit' },
                onError: 'fail',
              },
            },
            {
              id: 'decision',
              type: 'branch',
              cases: [
                { when: { gte: [{ $ref: 'item.available' }, { $param: 'quantity' }] }, then: 'emitReserved' },
                { default: true, then: 'emitRejected' },
              ],
            },
            {
              id: 'emitReserved',
              type: 'emit',
              config: {
                aggregate: 'StockReservation',
                aggregateId: { $node: 'newId' },
                transition: 'reserve',
                payload: { sku: { $param: 'sku' }, quantity: { $param: 'quantity' } },
              },
            },
            {
              id: 'out',
              type: 'result',
              value: { reserved: { $literal: true }, reservationId: { $ref: 'emitReserved.aggregateId' } },
            },
          ],
        },
      },
    });

    expect(r.ok).toBe(true);
  });
});
