import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { parseBindingArtifact, validateBindings } from '@rntme/bindings';
import type { BindingResolvers } from '@rntme/bindings';
import { executeCommand, CommandExecutionError } from '@rntme/graph-ir-compiler';
import { SqliteEventStore } from '@rntme/event-store';
import type { ActorRef } from '@rntme/event-store';
import { Hono } from 'hono';
import { createBindingsRouter } from '../../src/router.js';
import { BindingsRuntimeError } from '../../src/errors.js';
import type { CommandExecutor } from '../../src/executor-contract.js';
import type { BuildPlanResult } from '../../src/startup/compile-plan.js';
import { buildPlan } from '../../src/startup/compile-plan.js';
import { correlationMiddleware } from '../../src/runtime/correlation-middleware.js';
import {
  loadJson,
  parseGraphRuntimeInputs,
  parseRuntimeGraphSpec,
} from '../helpers/runtime-artifacts.js';

function wrapWithMiddleware(router: ReturnType<typeof createBindingsRouter>): Hono {
  const app = new Hono();
  app.use('*', correlationMiddleware());
  app.route('/', router);
  return app;
}

const here = dirname(fileURLToPath(import.meta.url));
const compilerRoot = join(here, '..', '..', '..', '..', 'artifacts', 'graph-ir-compiler');
const runtimeInputs = parseGraphRuntimeInputs({
  graphSpec: {
    version: '1.0-rc7',
    pdmRef: 'p',
    qsmRef: 'q',
    shapes: {},
    graphs: {
      reportIssue: {
        id: 'reportIssue',
        signature: {
          inputs: {
            issueId: { type: 'integer', mode: 'required' },
            projectId: { type: 'integer', mode: 'required' },
            reporterId: { type: 'integer', mode: 'required' },
            title: { type: 'string', mode: 'required' },
            priority: { type: 'string', mode: 'required' },
            storyPoints: { type: 'integer', mode: 'required' },
          },
          output: { type: 'row<CommandResult>', from: 'e' },
        },
        nodes: [
          {
            id: 'e',
            type: 'emit',
            config: {
              aggregate: 'Issue',
              aggregateId: { $param: 'issueId' },
              transition: 'report',
              payload: {
                title: { $param: 'title' },
                projectId: { $param: 'projectId' },
                reporterId: { $param: 'reporterId' },
                priority: { $param: 'priority' },
                storyPoints: { $param: 'storyPoints' },
              },
            },
          },
        ],
      },
      submitIssue: {
        id: 'submitIssue',
        signature: {
          inputs: { issueId: { type: 'integer', mode: 'required' } },
          output: { type: 'row<CommandResult>', from: 'e' },
        },
        nodes: [
          {
            id: 'e',
            type: 'emit',
            config: {
              aggregate: 'Issue',
              aggregateId: { $param: 'issueId' },
              transition: 'submit',
              payload: {},
            },
          },
        ],
      },
    },
  },
  pdm: loadJson(join(compilerRoot, 'test', 'e2e', 'fixtures', 'issue-tracker.pdm.json')),
  qsm: loadJson(join(compilerRoot, 'test', 'e2e', 'fixtures', 'issue-tracker.qsm.json')),
});
const { graphSpec: spec, pdm, qsm } = runtimeInputs;

const resolvers: BindingResolvers = {
  resolveGraphSignature: (id) => {
    if (id === 'reportIssue') {
      return {
        id,
        role: 'command',
        inputs: {
          issueId: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'required' },
          projectId: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'required' },
          reporterId: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'required' },
          title: { type: { kind: 'scalar', primitive: 'string' }, mode: 'required' },
          priority: { type: { kind: 'scalar', primitive: 'string' }, mode: 'required' },
          storyPoints: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'required' },
        },
        output: { type: { kind: 'row', shape: 'CommandResult' }, from: 'e' },
      };
    }
    if (id === 'submitIssue') {
      return {
        id,
        role: 'command',
        inputs: {
          issueId: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'required' },
        },
        output: { type: { kind: 'row', shape: 'CommandResult' }, from: 'e' },
      };
    }
    return null;
  },
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
    reportIssueHttp: {
      kind: 'command',
      graph: 'reportIssue',
      target: { engine: 'sqlite', dialect: 'sqlite' },
      http: {
        method: 'POST',
        path: '/v1/issues/{issueId}/actions/report',
        parameters: [
          { name: 'issueId', in: 'path', bindTo: 'issueId', required: true },
          { name: 'projectId', in: 'body', bindTo: 'projectId', required: true },
          { name: 'reporterId', in: 'body', bindTo: 'reporterId', required: true },
          { name: 'title', in: 'body', bindTo: 'title', required: true },
          { name: 'priority', in: 'body', bindTo: 'priority', required: true },
          { name: 'storyPoints', in: 'body', bindTo: 'storyPoints', required: true },
        ],
      },
    },
    submitIssueHttp: {
      kind: 'command',
      graph: 'submitIssue',
      target: { engine: 'sqlite', dialect: 'sqlite' },
      http: {
        method: 'POST',
        path: '/v1/issues/{issueId}/actions/submit',
        parameters: [{ name: 'issueId', in: 'path', bindTo: 'issueId', required: true }],
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

function makeCommandExecutor(plan: BuildPlanResult): CommandExecutor {
  return {
    execute: async (input) => {
      const compiled = plan.compiledCommands[input.commandName];
      if (compiled === undefined) {
        return {
          ok: false,
          error: {
            code: 'COMMAND_NOT_FOUND',
            message: `no compiled command registered for name "${input.commandName}"`,
          },
        };
      }

      try {
        const value = executeCommand(compiled, input.inputs, input.ctx);
        return { ok: true, value };
      } catch (error) {
        if (error instanceof CommandExecutionError) {
          return {
            ok: false,
            error: {
              code:
                error.code === 'COMMAND_CONCURRENCY_CONFLICT'
                  ? 'COMMAND_CONCURRENCY_CONFLICT'
                  : 'COMMAND_GUARD_REJECTED',
              message: error.message,
              detail: error.detail,
            },
          };
        }
        return {
          ok: false,
          error: {
            code: 'COMMAND_HANDLER_THREW',
            message: error instanceof Error ? error.message : String(error),
            detail: error,
          },
        };
      }
    },
  };
}

function build(): {
  router: Hono;
  store: SqliteEventStore;
  qsmDb: Database.Database;
} {
  const store = new SqliteEventStore({ filename: ':memory:', serviceName: 'test' });
  const qsmDb = new Database(':memory:');
  const actor: ActorRef = { kind: 'user', id: 'alice' };
  let seq = 0;
  const plan = buildPlan(validated(), spec, pdm, qsm);
  const inner = createBindingsRouter({
    validated: validated(),
    graphSpec: spec,
    pdm,
    qsm,
    db: qsmDb,
    eventStore: store,
    commandExecutor: makeCommandExecutor(plan),
    actorFromRequest: () => actor,
    now: () => '2026-04-14T10:00:00Z',
    nextId: () => `018e9d2a-0000-7000-8000-${String(++seq).padStart(12, '0')}`,
  });
  return { router: wrapWithMiddleware(inner), store, qsmDb };
}

describe('createBindingsRouter — command routing', () => {
  let ctx: ReturnType<typeof build>;
  beforeEach(() => {
    ctx = build();
  });
  afterEach(() => {
    ctx.store.close();
    ctx.qsmDb.close();
  });

  it('POST /v1/issues/{id}/actions/report returns 200 CommandResult and appends event', async () => {
    const res = await ctx.router.fetch(
      new Request('http://x/v1/issues/42/actions/report', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          projectId: 1,
          reporterId: 2,
          title: 'x',
          priority: 'high',
          storyPoints: 3,
        }),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      aggregateId: string;
      version: number;
      eventIds: string[];
      commandId: string;
      correlationId: string;
    };
    expect(body).toEqual(
      expect.objectContaining({
        aggregateId: '42',
        version: 1,
        eventIds: ['018e9d2a-0000-7000-8000-000000000001'],
      }),
    );
    expect(body.commandId).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.correlationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.headers.get('Correlation-Id')).toBe(body.correlationId);
    expect(ctx.store.readStream('Issue-42')).toHaveLength(1);
  });

  it('chains report → submit and version increments per transition', async () => {
    const post = (path: string, body: object): Promise<Response> =>
      Promise.resolve(
        ctx.router.fetch(
          new Request(`http://x${path}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
          }),
        ),
      );
    const r1 = await post('/v1/issues/42/actions/report', {
      projectId: 1,
      reporterId: 2,
      title: 'x',
      priority: 'high',
      storyPoints: 3,
    });
    expect(r1.status).toBe(200);
    const r2 = await post('/v1/issues/42/actions/submit', {});
    expect(r2.status).toBe(200);
    const body2 = (await r2.json()) as { version: number };
    expect(body2.version).toBe(2);
    const events = ctx.store.readStream('Issue-42');
    expect(events.map((e) => e.eventType)).toEqual(['IssueReport', 'IssueSubmit']);
  });

  it('throws at startup when a command binding is present but eventStore missing', () => {
    const qsmDb = new Database(':memory:');
    let error: unknown;
    try {
      createBindingsRouter({
        validated: validated(),
        graphSpec: spec,
        pdm,
        qsm,
        db: qsmDb,
      });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(BindingsRuntimeError);
    if (!(error instanceof BindingsRuntimeError)) throw error;
    expect(error.errors[0]).toMatchObject({
      bindingId: 'reportIssueHttp',
      graphId: 'reportIssue',
      cause: {
        code: 'BINDINGS_HTTP_STARTUP_MISSING_RUNTIME_DEPENDENCY',
        dependency: 'eventStore',
      },
    });
    qsmDb.close();
  });

  it('throws at startup when a command binding is present but commandExecutor missing', () => {
    const qsmDb = new Database(':memory:');
    const store = new SqliteEventStore({ filename: ':memory:', serviceName: 'test' });
    let error: unknown;
    try {
      createBindingsRouter({
        validated: validated(),
        graphSpec: spec,
        pdm,
        qsm,
        db: qsmDb,
        eventStore: store,
      });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(BindingsRuntimeError);
    if (!(error instanceof BindingsRuntimeError)) throw error;
    expect(error.errors[0]).toMatchObject({
      bindingId: 'reportIssueHttp',
      graphId: 'reportIssue',
      cause: {
        code: 'BINDINGS_HTTP_STARTUP_MISSING_RUNTIME_DEPENDENCY',
        dependency: 'commandExecutor',
      },
    });
    store.close();
    qsmDb.close();
  });

  it('maps a concurrent append conflict to 409 COMMAND_CONCURRENCY_CONFLICT', async () => {
    const r1 = await ctx.router.fetch(
      new Request('http://x/v1/issues/42/actions/report', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          projectId: 1,
          reporterId: 2,
          title: 'x',
          priority: 'high',
          storyPoints: 3,
        }),
      }),
    );
    expect(r1.status).toBe(200);
    ctx.store.appendEvents([
      {
        subject: 'Issue-42',
        expectedVersion: 1,
        events: [
          {
            id: 'external-0000',
            eventType: 'IssueSubmit',
            rntAggregateType: 'Issue',
            rntAggregateId: '42',
            time: '2026-04-14T10:00:00Z',
            actor: null,
            data: { before: { status: 'draft' }, after: { status: 'open' } },
            rntSchemaVersion: 1,
            correlationId: 'external-corr',
            causationId: null,
            commandId: null,
            traceparent: null,
          },
        ],
      },
    ]);
    const r2 = await ctx.router.fetch(
      new Request('http://x/v1/issues/42/actions/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }),
    );
    expect([409, 422]).toContain(r2.status);
    const body = (await r2.json()) as { code: string };
    expect(['COMMAND_CONCURRENCY_CONFLICT', 'COMMAND_GUARD_REJECTED']).toContain(body.code);
  });
});

describe('createBindingsRouter — command guards', () => {
  const guardedSpec = parseRuntimeGraphSpec({
    version: '1.0-rc7',
    pdmRef: 'p',
    qsmRef: 'q',
    shapes: {},
    graphs: {
      submitOnlyIfSeeded: {
        id: 'submitOnlyIfSeeded',
        signature: {
          inputs: { issueId: { type: 'integer', mode: 'required' } },
          output: { type: 'row<CommandResult>', from: 'emitSubmit' },
        },
        nodes: [
          {
            id: 'candidates',
            type: 'findMany',
            config: {
              source: { entity: 'Issue' },
            },
          },
          {
            id: 'emitSubmit',
            type: 'emit',
            config: {
              aggregate: 'Issue',
              aggregateId: { $param: 'issueId' },
              transition: 'submit',
              payload: {},
            },
          },
        ],
      },
    },
  });

  const guardedResolvers: BindingResolvers = {
    resolveGraphSignature: (id) =>
      id === 'submitOnlyIfSeeded'
        ? {
            id,
            role: 'command',
            inputs: {
              issueId: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'required' },
            },
            output: { type: { kind: 'row', shape: 'CommandResult' }, from: 'emitSubmit' },
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

  const guardedArtifact = {
    version: '1.0',
    graphSpecRef: 'x',
    pdmRef: 'p',
    qsmRef: 'q',
    bindings: {
      submitHttp: {
        kind: 'command',
        graph: 'submitOnlyIfSeeded',
        target: { engine: 'sqlite', dialect: 'sqlite' },
        http: {
          method: 'POST',
          path: '/v1/issues/{issueId}/actions/submit',
          parameters: [{ name: 'issueId', in: 'path', bindTo: 'issueId', required: true }],
        },
      },
    },
  };

  function buildGuarded(): {
    router: Hono;
    store: SqliteEventStore;
    qsmDb: Database.Database;
  } {
    const store = new SqliteEventStore({ filename: ':memory:', serviceName: 'test' });
    const qsmDb = new Database(':memory:');
    qsmDb.exec(`
      CREATE TABLE projection_issue (
        id INTEGER PRIMARY KEY,
        project_id INTEGER NOT NULL,
        reporter_id INTEGER,
        assignee_id INTEGER,
        sprint_id INTEGER,
        title TEXT,
        status TEXT NOT NULL,
        priority TEXT,
        story_points INTEGER,
        created_at TEXT,
        resolved_at TEXT,
        last_event_id TEXT,
        last_event_version INTEGER,
        applied_at TEXT
      );
    `);
    const parsed = parseBindingArtifact(guardedArtifact);
    if (!parsed.ok) throw new Error('parse fail');
    const v = validateBindings(parsed.value, guardedResolvers);
    if (!v.ok) throw new Error('validate fail');
    let seq = 0;
    const plan = buildPlan(v.value, guardedSpec, pdm, qsm);
    const inner = createBindingsRouter({
      validated: v.value,
      graphSpec: guardedSpec,
      pdm,
      qsm,
      db: qsmDb,
      eventStore: store,
      commandExecutor: makeCommandExecutor(plan),
      actorFromRequest: () => null,
      now: () => '2026-04-14T10:00:00Z',
      nextId: () => `018e9d2a-0000-7000-8000-${String(++seq).padStart(12, '0')}`,
    });
    return { router: wrapWithMiddleware(inner), store, qsmDb };
  }

  it('returns 422 COMMAND_GUARD_REJECTED when the read-prelude guard fails', async () => {
    const ctx = buildGuarded();
    try {
      const res = await ctx.router.fetch(
        new Request('http://x/v1/issues/999/actions/submit', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({}),
        }),
      );
      expect(res.status).toBe(422);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe('COMMAND_GUARD_REJECTED');
    } finally {
      ctx.store.close();
      ctx.qsmDb.close();
    }
  });
});
