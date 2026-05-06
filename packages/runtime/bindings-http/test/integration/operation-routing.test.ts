import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { createBindingsRouter } from '../../src/router.js';
import type { OperationExecutor } from '../../src/operation-contract.js';

describe('operation routing', () => {
  it('routes exposure=action through OperationExecutor and returns graph result', async () => {
    const executor: OperationExecutor = {
      async execute(input) {
        expect(input.operationName).toBe('reserveStock');
        return {
          ok: true,
          value: {
            value: { reserved: false, reason: 'insufficient stock' },
            metadata: {
              eventIds: ['evt-1'],
              commandId: input.ctx.correlation.commandId,
              correlationId: input.ctx.correlation.correlationId,
            },
          },
        };
      },
    };

    const app = new Hono();
    app.route('/api', createBindingsRouter({
      validated: {
        resolved: {
          reserveStock: {
            entry: {
              exposure: 'action',
              graph: 'reserveStock',
              target: { engine: 'sqlite', dialect: 'sqlite' },
              http: { method: 'POST', path: '/reservations', parameters: [] },
            },
            signature: {
              id: 'reserveStock',
              inputs: {},
              output: { type: { kind: 'row', shape: 'ReservationResult' }, from: 'out' },
              effects: { localReads: false, localEmits: [], calls: [], waits: false },
            },
            outputShape: { name: 'ReservationResult', origin: 'custom', fields: {} },
          },
        },
      } as never,
      graphSpec: {
        version: '1.0-rc7',
        pdmRef: 'p',
        qsmRef: 'q',
        shapes: { ReservationResult: { fields: {} } },
        graphs: {
          reserveStock: {
            id: 'reserveStock',
            signature: { inputs: {}, output: { type: 'row<ReservationResult>', from: 'out' } },
            nodes: [{ id: 'out', type: 'result', value: { reserved: { $literal: false } } }],
          },
        },
      } as never,
      pdm: { entities: {} } as never,
      qsm: { projections: {}, relations: {} } as never,
      db: new Database(':memory:'),
      eventStore: {} as never,
      operationExecutor: executor,
    }));

    const res = await app.request('/api/reservations', { method: 'POST' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reserved: false, reason: 'insufficient stock' });
  });
});
