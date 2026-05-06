import { describe, expect, it } from 'vitest';
import { buildPlan } from '../../src/startup/compile-plan.js';

describe('operation compile plan', () => {
  it('compiles read/action exposures into operation plans', () => {
    const result = buildPlan(
      {
        artifact: {} as never,
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
              effects: {
                localReads: true,
                localEmits: [{ aggregate: 'StockReservation', transition: 'reserve', eventType: 'StockReserved' }],
                calls: [],
                waits: false,
              },
            },
            outputShape: { name: 'ReservationResult', origin: 'custom', fields: {} },
          },
        },
      } as never,
      {
        version: '1.0-rc7',
        pdmRef: 'pdm',
        qsmRef: 'qsm',
        shapes: { ReservationResult: { fields: {} } },
        graphs: {
          reserveStock: {
            id: 'reserveStock',
            signature: { inputs: {}, output: { type: 'row<ReservationResult>', from: 'out' } },
            nodes: [{ id: 'out', type: 'result', value: { ok: { $literal: true } } }],
          },
        },
      } as never,
      { entities: {} } as never,
      { projections: {}, relations: {} } as never,
    );

    expect(result.plans.reserveStock?.exposure).toBe('action');
    expect(result.compiledOperations.reserveStock).toBeDefined();
  });
});
