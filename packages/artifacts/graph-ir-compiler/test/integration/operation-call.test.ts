import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import {
  compileOperation,
  executeOperation,
  type OperationCallClient,
  type OperationRegistry,
} from '../../src/index.js';

const registry: OperationRegistry = {
  resolve(target) {
    if ('service' in target && target.service === 'customers') {
      return {
        id: 'service:customers.getCreditStatus',
        target,
        effect: 'read',
        idempotency: 'none',
        inputShape: 'CreditInput',
        outputShape: 'CreditStatus',
      };
    }
    return null;
  },
};

describe('operation call nodes', () => {
  it('uses call output in branch and result', async () => {
    const graph = {
      version: '1.0-rc7',
      pdmRef: 'x',
      qsmRef: 'y',
      shapes: {
        Decision: { fields: { approved: { type: 'boolean', nullable: false } } },
      },
      graphs: {
        decide: {
          id: 'decide',
          signature: {
            inputs: { customerId: { type: 'string', mode: 'required' } },
            output: { type: 'row<Decision>', from: 'out' },
          },
          nodes: [
            {
              id: 'credit',
              type: 'call',
              target: { service: 'customers', operation: 'getCreditStatus' },
              input: { customerId: { $param: 'customerId' } },
              policy: { timeoutMs: 500, onError: 'fail' },
            },
            {
              id: 'out',
              type: 'result',
              value: { approved: { $ref: 'credit.result.approved' } },
            },
          ],
        },
      },
    };

    const compiled = compileOperation(
      graph,
      { entities: {} },
      { projections: {}, relations: {} },
      {
        registry,
        serviceName: 'orders',
        ownedAggregates: new Set(),
        exposure: 'read',
      },
    );
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;

    const calls: unknown[] = [];
    const callClient: OperationCallClient = {
      async call(input) {
        calls.push(input);
        return { ok: true, value: { approved: true } };
      },
    };

    const out = await executeOperation(
      compiled.value,
      { customerId: 'cust-1' },
      {
        qsmDb: new Database(':memory:'),
        eventStore: null,
        callClient,
        now: () => '2026-05-06T00:00:00.000Z',
        nextId: () => 'id',
        actor: null,
        correlation: { commandId: 'cmd', correlationId: 'corr', traceparent: null },
        idempotencyKey: null,
      },
    );

    expect(calls).toHaveLength(1);
    expect(out.value).toEqual({ approved: true });
  });
});
