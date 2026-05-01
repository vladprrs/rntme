import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { parseBindingArtifact, validateBindings } from '@rntme/bindings';
import type { BindingResolvers } from '@rntme/bindings';
import type { EventStore } from '@rntme/event-store';
import { createBindingsRouter } from '../../src/router.js';
import type { CommandExecutor } from '../../src/executor-contract.js';

const graphSpec = {
  version: '1.0-rc7',
  pdmRef: 'p',
  qsmRef: 'q',
  shapes: {},
  graphs: {
    oauthCallback: {
      id: 'oauthCallback',
      signature: {
        inputs: {
          state: { type: 'string', mode: 'required' },
          code: { type: 'string', mode: 'required' },
        },
        output: { type: 'row<CommandResult>', from: 'e' },
      },
      nodes: [
        {
          id: 'e',
          type: 'emit',
          config: {
            aggregate: 'Issue',
            aggregateId: { $param: 'state' },
            transition: 'report',
            payload: { title: { $param: 'code' } },
          },
        },
      ],
    },
  },
};

const resolvers: BindingResolvers = {
  resolveGraphSignature: (id) =>
    id === 'oauthCallback'
      ? {
          id,
          role: 'command',
          inputs: {
            state: { type: { kind: 'scalar', primitive: 'string' }, mode: 'required' },
            code: { type: { kind: 'scalar', primitive: 'string' }, mode: 'required' },
          },
          output: { type: { kind: 'row', shape: 'CommandResult' }, from: 'e' },
        }
      : null,
  resolveShape: (name) =>
    name === 'CommandResult'
      ? {
          name,
          origin: 'custom',
          fields: {
            aggregateId: { type: { kind: 'scalar', primitive: 'string' }, nullable: false },
            version: { type: { kind: 'scalar', primitive: 'integer' }, nullable: false },
            eventIds: { type: { kind: 'array', element: 'string' }, nullable: false },
          },
        }
      : null,
};

const pdm = {
  entities: {
    Issue: {
      ownerService: 'test-service',
      kind: 'owned',
      table: 'issues',
      fields: {
        id: { type: 'string', nullable: false, column: 'id' },
        status: { type: 'string', nullable: false, column: 'status' },
        title: { type: 'string', nullable: false, column: 'title' },
      },
      keys: ['id'],
      stateMachine: {
        stateField: 'status',
        initial: null,
        states: ['draft'],
        transitions: {
          report: { from: null, to: 'draft', affects: ['title'] },
        },
      },
    },
  },
};

const qsm = { projections: {}, relations: {} };

const artifact = {
  version: '1.0',
  graphSpecRef: 'x',
  pdmRef: 'p',
  qsmRef: 'q',
  bindings: {
    completeCallback: {
      kind: 'command',
      graph: 'oauthCallback',
      target: { engine: 'graph-ir', dialect: 'sqlite' },
      http: { method: 'GET', path: '/oauth/stripe/callback', parameters: [] },
      inputFrom: {
        state: { from: 'query', name: 'state', required: true },
        code: { from: 'query', name: 'code', required: true },
      },
      response: {
        onOk: { redirect: '/app/connected?flow={$result.aggregateId}', status: 302 },
        onErr: { json: '$error' },
      },
    },
  },
};

function validated() {
  const parsed = parseBindingArtifact(artifact);
  if (!parsed.ok) throw new Error('parse fail');
  const v = validateBindings(parsed.value, resolvers);
  if (!v.ok) throw new Error('validate fail');
  return v.value;
}

describe('P2 callback binding (GET + inputFrom + redirect)', () => {
  it('executes the command and returns 302 Location on success', async () => {
    const executor: CommandExecutor = {
      execute: async () => ({
        ok: true,
        value: {
          aggregateId: 'abc-123',
          version: 1,
          eventIds: ['e-1'],
          commandId: 'c-1',
          correlationId: 'corr-1',
        },
      }),
    };

    const db = new Database(':memory:');
    const router = createBindingsRouter({
      validated: validated(),
      graphSpec,
      pdm,
      qsm,
      db,
      commandExecutor: executor,
      eventStore: {} as EventStore,
    });

    const resp = await router.fetch(
      new Request('http://x/oauth/stripe/callback?state=abc&code=xyz'),
    );
    expect(resp.status).toBe(302);
    expect(resp.headers.get('Location')).toBe('/app/connected?flow=abc-123');
    db.close();
  });

  it('returns a 422 JSON error when executor returns err', async () => {
    const executor: CommandExecutor = {
      execute: async () => ({
        ok: false,
        error: { code: 'COMMAND_GUARD_REJECTED', message: 'no such flow' },
      }),
    };

    const db = new Database(':memory:');
    const router = createBindingsRouter({
      validated: validated(),
      graphSpec,
      pdm,
      qsm,
      db,
      commandExecutor: executor,
      eventStore: {} as EventStore,
    });

    const resp = await router.fetch(
      new Request('http://x/oauth/stripe/callback?state=bad&code=x'),
    );
    expect(resp.status).toBe(422);
    expect(await resp.json()).toEqual({
      code: 'COMMAND_GUARD_REJECTED',
      message: 'no such flow',
    });
    db.close();
  });

  it('replays the same redirect on GET with the same Idempotency-Key', async () => {
    let callCount = 0;
    const executor: CommandExecutor = {
      execute: async () => {
        callCount++;
        return {
          ok: true,
          value: {
            aggregateId: 'abc-123',
            version: 1,
            eventIds: ['e-1'],
            commandId: 'c-1',
            correlationId: 'corr-1',
          },
        };
      },
    };

    const db = new Database(':memory:');
    const router = createBindingsRouter({
      validated: validated(),
      graphSpec,
      pdm,
      qsm,
      db,
      commandExecutor: executor,
      eventStore: {} as EventStore,
    });

    const req = new Request('http://x/oauth/stripe/callback?state=abc&code=xyz', {
      headers: { 'Idempotency-Key': 'cb-1' },
    });
    const resp1 = await router.fetch(req.clone());
    const resp2 = await router.fetch(req.clone());

    expect(resp1.status).toBe(302);
    expect(resp2.status).toBe(302);
    expect(resp1.headers.get('Location')).toBe('/app/connected?flow=abc-123');
    expect(resp2.headers.get('Location')).toBe('/app/connected?flow=abc-123');
    expect(resp2.headers.get('Idempotency-Replay')).toBe('true');
    expect(callCount).toBe(1);
    db.close();
  });
});
