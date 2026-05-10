import { describe, expect, it } from 'bun:test';
import { inferEffectSummary, validateOperationEffects } from '../../../src/validate/effects.js';
import type { CanonicalGraph } from '../../../src/types/canonical.js';
import type { OperationRegistry } from '../../../src/types/operation.js';

const registry: OperationRegistry = {
  resolve(target) {
    if ('service' in target && target.operation === 'getCreditStatus') {
      return {
        id: 'service:customers.getCreditStatus',
        target,
        effect: 'read',
        idempotency: 'none',
        inputShape: 'GetCreditStatusInput',
        outputShape: 'CreditStatus',
      };
    }
    if ('module' in target && target.operation === 'CreateCheckoutSession') {
      return {
        id: 'module:payments.CreateCheckoutSession',
        target,
        effect: 'action',
        idempotency: 'required',
        inputShape: 'CheckoutInput',
        outputShape: 'CheckoutSession',
      };
    }
    return null;
  },
};

function graph(nodes: CanonicalGraph['nodes']): CanonicalGraph {
  return {
    id: 'g',
    signature: { inputs: {}, output: { type: 'row<Result>', from: 'out' } },
    nodes,
    outputFrom: 'out',
  };
}

describe('operation effects', () => {
  it('infers local reads, local emits, and call effects', () => {
    const r = inferEffectSummary(
      graph([
        {
          kind: 'findOne',
          id: 'item',
          scope: 's1',
          source: { projection: 'InventoryItemView' },
          alias: 'inventoryItemView',
          where: { $literal: 'x' },
        },
        {
          kind: 'call',
          id: 'credit',
          scope: 's2',
          target: { service: 'customers', operation: 'getCreditStatus' },
          input: {},
          policy: { timeoutMs: 500, onError: 'fail' },
        },
        {
          kind: 'emit',
          id: 'e',
          scope: 's3',
          aggregate: 'StockReservation',
          aggregateId: { $param: 'id' },
          transition: 'reserve',
          payload: {},
        },
        { kind: 'result', id: 'out', scope: 's4', value: { ok: true } },
      ]),
      registry,
      { 'StockReservation.reserve': 'StockReserved' },
    );

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.localReads).toBe(true);
      expect(r.value.calls).toEqual([
        {
          target: 'service',
          operation: 'customers.getCreditStatus',
          effect: 'read',
          idempotency: 'none',
        },
      ]);
      expect(r.value.localEmits).toEqual([
        { aggregate: 'StockReservation', transition: 'reserve', eventType: 'StockReserved' },
      ]);
    }
  });

  it('rejects unresolved call targets and foreign emits', () => {
    const r = validateOperationEffects({
      graph: graph([
        {
          kind: 'call',
          id: 'missing',
          scope: 's1',
          target: { service: 'unknown', operation: 'nope' },
          input: {},
          policy: { timeoutMs: 500, onError: 'fail' },
        },
        {
          kind: 'emit',
          id: 'e',
          scope: 's2',
          aggregate: 'ForeignAggregate',
          aggregateId: { $param: 'id' },
          transition: 'x',
          payload: {},
        },
        { kind: 'result', id: 'out', scope: 's3', value: { ok: true } },
      ]),
      registry,
      ownedAggregates: new Set(['StockReservation']),
      eventTypesByAggregateTransition: new Map(),
    });

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.map((e) => e.code)).toEqual(
        expect.arrayContaining(['GRAPH_CALL_TARGET_UNRESOLVED', 'GRAPH_EMIT_FOREIGN_AGGREGATE']),
      );
    }
  });
});
