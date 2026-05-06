import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { createBindingsRouter } from '../../src/router.js';
import { BindingsRuntimeError } from '../../src/errors.js';
import type { OperationExecutor } from '../../src/operation-contract.js';

const validated = {
  artifact: {} as never,
  resolved: {
    listThings: {
      entry: {
        exposure: 'read',
        graph: 'listThings',
        target: { engine: 'sqlite', dialect: 'sqlite' },
        http: {
          method: 'GET',
          path: '/things',
          parameters: [{ name: 'limit', in: 'query', bindTo: 'limit', required: false }],
        },
      },
      signature: {
        id: 'listThings',
        inputs: { limit: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'defaulted', default: 20 } },
        output: { type: { kind: 'row', shape: 'ThingRow' }, from: 'out' },
        effects: { localReads: true, localEmits: [], calls: [], waits: false },
      },
      outputShape: { name: 'ThingRow', origin: 'custom', fields: {} },
    },
  },
} as never;

const graphSpec = {
  version: '1.0-rc7',
  pdmRef: 'p',
  qsmRef: 'q',
  shapes: { ThingRow: { fields: {} } },
  graphs: {
    listThings: {
      id: 'listThings',
      signature: {
        inputs: { limit: { type: 'integer', mode: 'defaulted', default: 20 } },
        output: { type: 'row<ThingRow>', from: 'out' },
      },
      nodes: [{ id: 'out', type: 'result', value: { id: { $literal: 1 } } }],
    },
  },
} as never;

function makeRouter(executor: OperationExecutor, openApiDoc?: never) {
  const opts = {
    validated,
    graphSpec,
    pdm: { entities: {} } as never,
    qsm: { projections: {}, relations: {} } as never,
    db: new Database(':memory:'),
    operationExecutor: executor,
  };
  return createBindingsRouter(openApiDoc === undefined ? opts : { ...opts, openApiDoc });
}

describe('createBindingsRouter', () => {
  it('serves read operation bindings through OperationExecutor', async () => {
    const executor: OperationExecutor = {
      async execute(input) {
        expect(input.operationName).toBe('listThings');
        expect(input.inputs).toEqual({ limit: 5 });
        return {
          ok: true,
          value: {
            value: [{ id: 1 }],
            metadata: { eventIds: [], commandId: 'cmd', correlationId: 'corr' },
          },
        };
      },
    };

    const res = await makeRouter(executor).request('/things?limit=5');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ id: 1 }]);
  });

  it('mounts GET /openapi.json when openApiDoc is provided', async () => {
    const executor: OperationExecutor = {
      async execute() {
        throw new Error('not called');
      },
    };
    const router = makeRouter(executor, { openapi: '3.1.0', info: { title: 'API', version: '1' }, paths: {}, components: { schemas: {} } } as never);
    const res = await router.request('/openapi.json');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ openapi: '3.1.0' });
  });

  it('throws BindingsRuntimeError when compile fails at startup', () => {
    expect(() =>
      createBindingsRouter({
        validated,
        graphSpec: { version: '1.0-rc7', pdmRef: 'p', qsmRef: 'q', shapes: {}, graphs: {} } as never,
        pdm: { entities: {} } as never,
        qsm: { projections: {}, relations: {} } as never,
        db: new Database(':memory:'),
        operationExecutor: { async execute() { throw new Error('not called'); } },
      }),
    ).toThrow(BindingsRuntimeError);
  });
});
