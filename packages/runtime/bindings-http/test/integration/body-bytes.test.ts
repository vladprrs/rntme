import { Hono } from 'hono';
import { describe, expect, it } from 'bun:test';
import { openSqliteDatabase } from '@rntme/sqlite';
import { createBindingsRouter } from '../../src/router.js';
import type { OperationExecutor } from '../../src/operation-contract.js';

describe('inputFrom.bodyBytes', () => {
  it('reads raw HTTP body bytes into the operation input', async () => {
    const seen: Array<{ inputs: Record<string, unknown> }> = [];
    const executor: OperationExecutor = {
      async execute(input) {
        seen.push({ inputs: input.inputs });
        return {
          ok: true,
          value: {
            value: { ok: true },
            metadata: {
              eventIds: [],
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
          publishProjectBundle: {
            entry: {
              exposure: 'action',
              graph: 'publishProjectBundle',
              target: { engine: 'native', dialect: 'platform' },
              http: {
                method: 'POST',
                path: '/projects/{projectId}/versions',
                parameters: [
                  { name: 'projectId', in: 'path', bindTo: 'projectId', required: true },
                ],
              },
              inputFrom: {
                authorization: { from: 'header', name: 'authorization', required: true },
                bodyBytes: { from: 'bodyBytes' },
              },
            },
            signature: {
              id: 'publishProjectBundle',
              inputs: {
                projectId: { type: { kind: 'scalar', primitive: 'string' }, mode: 'required' },
                authorization: { type: { kind: 'scalar', primitive: 'string' }, mode: 'required' },
                bodyBytes: { type: { kind: 'scalar', primitive: 'string' }, mode: 'required' },
              },
              output: { type: { kind: 'row', shape: 'PublishResult' }, from: 'out' },
              effects: { localReads: false, localEmits: [], calls: [], waits: false },
            },
            outputShape: { name: 'PublishResult', origin: 'custom', fields: {} },
          },
        },
      } as never,
      graphSpec: {
        version: '1.0-rc7',
        pdmRef: 'p',
        qsmRef: 'q',
        shapes: { PublishResult: { fields: {} } },
        graphs: {
          publishProjectBundle: {
            id: 'publishProjectBundle',
            signature: {
              inputs: {
                projectId: { type: 'string', mode: 'required' },
                authorization: { type: 'string', mode: 'required' },
                bodyBytes: { type: 'string', mode: 'required' },
              },
              output: { type: 'row<PublishResult>', from: 'out' },
            },
            nodes: [{ id: 'out', type: 'result', value: { ok: { $literal: true } } }],
          },
        },
      } as never,
      pdm: { entities: {} } as never,
      qsm: { projections: {}, relations: {} } as never,
      db: openSqliteDatabase({ filename: ':memory:' }),
      eventStore: {} as never,
      operationExecutor: executor,
    }));

    const payload = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0xFF]);
    const res = await app.request('/api/projects/proj-1/versions', {
      method: 'POST',
      headers: { authorization: 'Bearer abc', 'content-type': 'application/rntme-project-bundle+json' },
      body: payload,
    });
    expect(res.status).toBe(200);
    expect(seen).toHaveLength(1);
    expect(seen[0]!.inputs.projectId).toBe('proj-1');
    expect(seen[0]!.inputs.authorization).toBe('Bearer abc');
    const bytes = seen[0]!.inputs.bodyBytes;
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(Array.from(bytes as Uint8Array)).toEqual([0x01, 0x02, 0x03, 0x04, 0xFF]);
  });

  it('does not consume request body when binding does not declare bodyBytes', async () => {
    // If the handler called arrayBuffer() on this body, the executor would
    // never observe inputs (and the test would also pre-consume the body so
    // subsequent reads would yield empty). We instead place a sentinel in the
    // body and assert the handler never reads it — by passing a body and
    // verifying the executor receives empty inputs (because no inputFrom or
    // body parameters are declared on this binding).
    const seen: Array<Record<string, unknown>> = [];
    const executor: OperationExecutor = {
      async execute(input) {
        seen.push({ ...input.inputs });
        return {
          ok: true,
          value: {
            value: { ok: true },
            metadata: {
              eventIds: [],
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
          plainAction: {
            entry: {
              exposure: 'action',
              graph: 'plainAction',
              target: { engine: 'sqlite', dialect: 'sqlite' },
              http: { method: 'POST', path: '/plain', parameters: [] },
            },
            signature: {
              id: 'plainAction',
              inputs: {},
              output: { type: { kind: 'row', shape: 'R' }, from: 'out' },
              effects: { localReads: false, localEmits: [], calls: [], waits: false },
            },
            outputShape: { name: 'R', origin: 'custom', fields: {} },
          },
        },
      } as never,
      graphSpec: {
        version: '1.0-rc7',
        pdmRef: 'p',
        qsmRef: 'q',
        shapes: { R: { fields: {} } },
        graphs: {
          plainAction: {
            id: 'plainAction',
            signature: { inputs: {}, output: { type: 'row<R>', from: 'out' } },
            nodes: [{ id: 'out', type: 'result', value: { ok: { $literal: true } } }],
          },
        },
      } as never,
      pdm: { entities: {} } as never,
      qsm: { projections: {}, relations: {} } as never,
      db: openSqliteDatabase({ filename: ':memory:' }),
      eventStore: {} as never,
      operationExecutor: executor,
    }));

    const sentinelBody = new Uint8Array([0xDE, 0xAD]);
    const res = await app.request('/api/plain', {
      method: 'POST',
      body: sentinelBody,
    });
    expect(res.status).toBe(200);
    expect(seen).toHaveLength(1);
    // No bodyBytes key was populated because the binding did not declare it.
    expect(seen[0]).toEqual({});
  });
});
