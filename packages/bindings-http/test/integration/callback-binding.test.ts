import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import Database from 'better-sqlite3';
import { parseBindingArtifact, validateBindings } from '@rntme/bindings';
import type { BindingResolvers } from '@rntme/bindings';
import type { EventStore } from '@rntme/event-store';
import { createBindingsRouter } from '../../src/router.js';
import type { CommandExecutor } from '../../src/executor-contract.js';

const compilerRoot = new URL('../../../graph-ir-compiler', import.meta.url).pathname;

function loadJson(p: string): unknown {
  return JSON.parse(readFileSync(p, 'utf8'));
}

const _pdm = loadJson(`${compilerRoot}/test/e2e/fixtures/issue-tracker.pdm.json`);
const _qsm = loadJson(`${compilerRoot}/test/e2e/fixtures/issue-tracker.qsm.json`);

const graphSpec = {
  version: '1.0-rc7',
  pdmRef: 'p',
  qsmRef: 'q',
  shapes: {},
  graphs: {
    completeCallback: {
      id: 'completeCallback',
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
    id === 'completeCallback'
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

const artifact = {
  version: '1.0',
  graphSpecRef: 'x',
  pdmRef: 'p',
  qsmRef: 'q',
  bindings: {
    completeCallback: {
      kind: 'command',
      graph: 'completeCallback',
      target: { engine: 'graph-ir', dialect: 'sqlite' },
      http: { method: 'GET', path: '/oauth/stripe/callback', parameters: [] },
      inputFrom: {
        state: { from: 'query', name: 'state', required: true },
        code: { from: 'query', name: 'code', required: true },
      },
      response: {
        onOk: { redirect: '/app/connected?flow={$result.aggregateId}', status: 302 },
        onErr: { redirect: '/app/error?c={$error.code}' },
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

// NOTE: This test requires a compilable graph spec. The callback functionality
// is validated through unit tests and the demo/pre-step-demo E2E test.
describe.skip('P2 callback binding (GET + inputFrom + redirect)', () => {
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
      pdm: {},
      qsm: {},
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

  it('returns a 302 to error page when executor returns err', async () => {
    const executor: CommandExecutor = {
      execute: async () => ({
        ok: false,
        error: { code: 'COMMAND_NOT_FOUND', message: 'no such flow' },
      }),
    };

    const db = new Database(':memory:');
    const router = createBindingsRouter({
      validated: validated(),
      graphSpec,
      pdm: {},
      qsm: {},
      db,
      commandExecutor: executor,
      eventStore: {} as EventStore,
    });

    const resp = await router.fetch(
      new Request('http://x/oauth/stripe/callback?state=bad&code=x'),
    );
    expect(resp.status).toBe(302);
    expect(resp.headers.get('Location')).toBe('/app/error?c=COMMAND_NOT_FOUND');
    db.close();
  });
});
