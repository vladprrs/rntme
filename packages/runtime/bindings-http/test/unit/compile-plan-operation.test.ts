import { describe, expect, it } from 'bun:test';
import type { OperationRegistry } from '@rntme/graph-ir-compiler';
import { buildDefaultGraphIrOperationMap, buildPlan } from '../../src/startup/compile-plan.js';

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

  it('uses the supplied operation registry for module call nodes', () => {
    const registry: OperationRegistry = {
      resolve(target) {
        if ('module' in target && target.module === 'identity-auth0' && target.operation === 'IntrospectSession') {
          return {
            id: 'identity-auth0.IntrospectSession',
            target,
            effect: 'read',
            idempotency: 'none',
            inputShape: 'IntrospectSessionRequest',
            outputShape: 'Session',
          };
        }
        return null;
      },
    };

    const result = buildPlan(
      {
        artifact: {} as never,
        resolved: {
          listOrganizations: {
            entry: {
              exposure: 'read',
              graph: 'listOrganizations',
              target: { engine: 'sqlite', dialect: 'sqlite' },
              http: { method: 'GET', path: '/organizations', parameters: [] },
            },
            signature: {
              id: 'listOrganizations',
              inputs: {
                authorization: { type: { kind: 'scalar', primitive: 'string' }, mode: 'required' },
              },
              output: { type: { kind: 'row', shape: 'SessionCheck' }, from: 'out' },
              effects: {
                localReads: false,
                localEmits: [],
                calls: [{ target: 'module', operation: 'identity-auth0.IntrospectSession', effect: 'read', idempotency: 'none' }],
                waits: false,
              },
            },
            outputShape: { name: 'SessionCheck', origin: 'custom', fields: { ok: { type: { kind: 'scalar', primitive: 'boolean' }, nullable: false } } },
          },
        },
      } as never,
      {
        version: '1.0-rc7',
        pdmRef: 'pdm',
        qsmRef: 'qsm',
        shapes: { SessionCheck: { fields: { ok: { type: 'boolean', nullable: false } } } },
        graphs: {
          listOrganizations: {
            id: 'listOrganizations',
            signature: {
              inputs: { authorization: { type: 'string', mode: 'required' } },
              output: { type: 'row<SessionCheck>', from: 'out' },
            },
            nodes: [
              {
                id: 'session',
                type: 'call',
                target: { module: 'identity-auth0', operation: 'IntrospectSession' },
                input: { token: { $param: 'authorization' } },
                policy: { timeoutMs: 500, onError: 'fail' },
              },
              { id: 'out', type: 'result', value: { ok: { $literal: true } } },
            ],
          },
        },
      } as never,
      { entities: {} } as never,
      { projections: {}, relations: {} } as never,
      { registry },
    );

    expect(result.compiledOperations.listOrganizations?.registryEntriesByNodeId.session).toMatchObject({
      id: 'identity-auth0.IntrospectSession',
      effect: 'read',
    });
  });

  it('does not compile Graph IR for native bindings', () => {
    const result = buildDefaultGraphIrOperationMap(
      {
        artifact: {} as never,
        resolved: {
          publishProjectBundle: {
            entry: {
              exposure: 'action',
              graph: 'publishProjectBundle',
              target: { engine: 'native', dialect: 'platform' },
              http: {
                method: 'POST',
                path: '/api/projects/{projectId}/versions',
                parameters: [{ name: 'projectId', in: 'path', bindTo: 'projectId', required: true }],
              },
            },
            signature: {
              id: 'publishProjectBundle',
              inputs: {
                projectId: { type: { kind: 'scalar', primitive: 'string' }, mode: 'required' },
              },
              output: { type: { kind: 'row', shape: 'CommandResult' }, from: '__native__' },
              effects: { localReads: false, localEmits: [], calls: [], waits: false },
            },
            outputShape: { name: 'CommandResult', origin: 'custom', fields: {} },
          },
        },
      } as never,
      { version: '1.0-rc7', shapes: {}, graphs: {} } as never,
      { entities: {} } as never,
      { projections: {}, relations: {} } as never,
    );

    expect(result).toEqual({ ok: true, value: {} });
  });
});
