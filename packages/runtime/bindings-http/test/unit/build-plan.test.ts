import { describe, expect, it } from 'vitest';
import { buildPlan } from '../../src/startup/compile-plan.js';
import { BindingsRuntimeError } from '../../src/errors.js';

const validated = {
  artifact: {} as never,
  resolved: {
    reserveStockHttp: {
      entry: {
        exposure: 'action',
        graph: 'reserveStock',
        target: { engine: 'sqlite', dialect: 'sqlite' },
        http: {
          method: 'POST',
          path: '/reservations/{reservationId}',
          parameters: [
            { name: 'reservationId', in: 'path', bindTo: 'reservationId', required: true },
            { name: 'sku', in: 'body', bindTo: 'sku', required: true },
          ],
        },
      },
      signature: {
        id: 'reserveStock',
        inputs: {
          reservationId: { type: { kind: 'scalar', primitive: 'string' }, mode: 'required' },
          sku: { type: { kind: 'scalar', primitive: 'string' }, mode: 'required' },
        },
        output: { type: { kind: 'row', shape: 'ReservationResult' }, from: 'out' },
        effects: {
          localReads: false,
          localEmits: [],
          calls: [],
          waits: false,
        },
      },
      outputShape: { name: 'ReservationResult', origin: 'custom', fields: {} },
    },
  },
} as never;

const spec = {
  version: '1.0-rc7',
  pdmRef: 'p',
  qsmRef: 'q',
  shapes: { ReservationResult: { fields: {} } },
  graphs: {
    reserveStock: {
      id: 'reserveStock',
      signature: {
        inputs: {
          reservationId: { type: 'string', mode: 'required' },
          sku: { type: 'string', mode: 'required' },
        },
        output: { type: 'row<ReservationResult>', from: 'out' },
      },
      nodes: [{ id: 'out', type: 'result', value: { sku: { $param: 'sku' } } }],
    },
  },
} as never;

describe('buildPlan', () => {
  it('returns operation plans and compiled operation cache', () => {
    const plan = buildPlan(validated, spec, { entities: {} } as never, { projections: {}, relations: {} } as never);

    expect(Object.keys(plan.plans)).toEqual(['reserveStockHttp']);
    expect(plan.plans.reserveStockHttp?.exposure).toBe('action');
    expect(plan.plans.reserveStockHttp?.operationName).toBe('reserveStock');
    expect(plan.plans.reserveStockHttp?.bindToMap).toEqual({
      reservationId: 'reservationId',
      sku: 'sku',
    });
    expect(plan.plans.reserveStockHttp?.schemas.bodySchema).toBeDefined();
    expect(plan.compiledOperations.reserveStock).toBeDefined();
  });

  it('throws BindingsRuntimeError when operation compile fails', () => {
    expect(() =>
      buildPlan(
        validated,
        { version: '1.0-rc7', pdmRef: 'p', qsmRef: 'q', shapes: {}, graphs: {} } as never,
        { entities: {} } as never,
        { projections: {}, relations: {} } as never,
      ),
    ).toThrow(BindingsRuntimeError);
  });
});
