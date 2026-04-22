import { describe, it, expect } from 'vitest';
import BetterSqlite3 from 'better-sqlite3';
import { SqliteEventStore } from '@rntme/event-store';
import { createBindingsRouter } from '../../src/index.js';
import { parseBindingArtifact, validateBindings } from '@rntme/bindings';
import type { BindingResolvers } from '@rntme/bindings';
import type { CommandExecutor, CommandExecutorInput, CommandExecutorOutput } from '../../src/executor-contract.js';

const resolvers: BindingResolvers = {
  resolveGraphSignature: (id) =>
    id === 'noop'
      ? {
          id,
          role: 'command',
          inputs: {},
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
            commandId: { type: { kind: 'scalar', primitive: 'string' }, nullable: false },
            correlationId: { type: { kind: 'scalar', primitive: 'string' }, nullable: false },
          },
        }
      : null,
};

const graphSpec = {
  version: '1.0-rc7',
  pdmRef: 'p',
  qsmRef: 'q',
  shapes: {},
  graphs: {
    noop: {
      id: 'noop',
      signature: {
        inputs: {},
        output: { type: 'row<CommandResult>', from: 'e' },
      },
      nodes: [
        {
          id: 'e',
          type: 'emit',
          config: {
            aggregate: 'Issue',
            aggregateId: { $literal: 'a-1' },
            transition: 'report',
            payload: {},
          },
        },
      ],
    },
  },
};

const pdm = {
  entities: {
    Issue: {
      table: 'issues',
      fields: {
        id: { type: 'string', nullable: false, column: 'id' },
        status: { type: 'string', nullable: false, column: 'status' },
      },
      keys: ['id'],
      stateMachine: {
        stateField: 'status',
        initial: null,
        states: ['draft'],
        transitions: {
          report: { from: null, to: 'draft', affects: [] },
        },
      },
    },
  },
};

const qsm = { projections: {}, relations: {} };

const artifact = {
  version: '1.0' as const,
  graphSpecRef: 'x',
  pdmRef: 'p',
  qsmRef: 'q',
  bindings: {
    noopHttp: {
      kind: 'command',
      graph: 'noop',
      target: { engine: 'sqlite', dialect: 'sqlite' },
      http: {
        method: 'POST',
        path: '/noop',
        parameters: [],
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

describe('Idempotency-Key', () => {
  it('replays the cached response on second call with same key', async () => {
    const db = new BetterSqlite3(':memory:');
    const eventStore = new SqliteEventStore({ filename: ':memory:', serviceName: 'tst' });
    let callCount = 0;

    const commandExecutor: CommandExecutor = {
      execute: async (_input: CommandExecutorInput): Promise<CommandExecutorOutput> => {
        callCount++;
        return {
          ok: true,
          value: {
            aggregateId: 'a-1',
            version: callCount,
            eventIds: [`e-${callCount}`],
            commandId: 'c',
            correlationId: 'corr',
          },
        };
      },
    };

    const router = createBindingsRouter({
      validated: validated(),
      graphSpec,
      pdm,
      qsm,
      db,
      eventStore,
      commandExecutor,
    });

    const resp1 = await router.request('/noop', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'abc', 'content-type': 'application/json' },
      body: '{}',
    });
    const resp2 = await router.request('/noop', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'abc', 'content-type': 'application/json' },
      body: '{}',
    });

    expect(resp1.status).toBe(200);
    expect(resp2.status).toBe(200);
    expect(resp2.headers.get('Idempotency-Replay')).toBe('true');
    expect(await resp2.text()).toBe(await resp1.text());
    expect(callCount).toBe(1); // executor only ran once

    eventStore.close();
    db.close();
  });
});
