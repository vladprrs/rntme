import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';
import { parseBindingArtifact, validateBindings } from '@rntme/bindings';
import type { BindingResolvers } from '@rntme/bindings';
import { SqliteEventStore } from '@rntme/event-store';
import type { ActorRef } from '@rntme/event-store';
import { buildPlan, type CommandBindingPlan } from '../../src/startup/compile-plan.js';
import { makeCommandHandler } from '../../src/runtime/command-handler.js';
import { correlationMiddleware } from '../../src/runtime/correlation-middleware.js';
import { honoPath } from '../../src/startup/hono-path.js';

const here = dirname(fileURLToPath(import.meta.url));
const compilerRoot = join(here, '..', '..', '..', 'graph-ir-compiler');
const loadJson = <T>(p: string): T => JSON.parse(readFileSync(p, 'utf8')) as T;
const pdm = loadJson(join(compilerRoot, 'test', 'e2e', 'fixtures', 'issue-tracker.pdm.json'));
const qsm = loadJson(join(compilerRoot, 'test', 'e2e', 'fixtures', 'issue-tracker.qsm.json'));

const reportSpec = {
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
  },
};

const resolvers: BindingResolvers = {
  resolveGraphSignature: (id) =>
    id === 'reportIssue'
      ? {
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
  },
};

function buildAppAndStore(): {
  app: Hono;
  store: SqliteEventStore;
  actor: ActorRef | null;
} {
  const parsed = parseBindingArtifact(artifact);
  if (!parsed.ok) throw new Error('parse fail');
  const validated = validateBindings(parsed.value, resolvers);
  if (!validated.ok) throw new Error('validate fail');
  const plan = buildPlan(validated.value, reportSpec, pdm, qsm);
  const bp = plan.reportIssueHttp;
  if (!bp || bp.kind !== 'command') throw new Error('expected command plan');
  const store = new SqliteEventStore({ filename: ':memory:', serviceName: 'test' });
  const actor: ActorRef = { kind: 'user', id: 'alice' };
  let seq = 0;
  const app = new Hono();
  app.use('*', correlationMiddleware());
  app.post(
    honoPath(bp.entry.http.path),
    makeCommandHandler(bp as CommandBindingPlan, {
      eventStore: store,
      qsmDb: null,
      now: () => '2026-04-14T10:00:00Z',
      nextId: () => `018e9d2a-0000-7000-8000-${String(++seq).padStart(12, '0')}`,
      actorFromRequest: () => actor,
    }),
  );
  return { app, store, actor };
}

describe('makeCommandHandler — happy path', () => {
  let ctx: ReturnType<typeof buildAppAndStore>;

  beforeEach(() => {
    ctx = buildAppAndStore();
  });

  afterEach(() => {
    ctx.store.close();
  });

  it('returns 200 and CommandResult JSON on successful report', async () => {
    const res = await ctx.app.fetch(
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
    expect(body.aggregateId).toBe('42');
    expect(body.version).toBe(1);
    expect(body.eventIds).toHaveLength(1);
    expect(body.commandId).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.correlationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.headers.get('Correlation-Id')).toBe(body.correlationId);
    const events = ctx.store.readStream('Issue-42');
    expect(events).toHaveLength(1);
    expect(events[0]!.rntActorKind).toBe('user');
    expect(events[0]!.rntActorId).toBe('alice');
  });
});

describe('makeCommandHandler — 400 on body validation', () => {
  let ctx: ReturnType<typeof buildAppAndStore>;
  beforeEach(() => {
    ctx = buildAppAndStore();
  });
  afterEach(() => {
    ctx.store.close();
  });

  it('returns 400 when required body field is missing', async () => {
    const res = await ctx.app.fetch(
      new Request('http://x/v1/issues/42/actions/report', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ projectId: 1, reporterId: 2, title: 'x', priority: 'high' }),
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when body is not valid JSON', async () => {
    const res = await ctx.app.fetch(
      new Request('http://x/v1/issues/42/actions/report', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '<not json>',
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('INVALID_BODY');
  });
});

describe('makeCommandHandler — 422 on illegal transition', () => {
  let ctx: ReturnType<typeof buildAppAndStore>;
  beforeEach(() => {
    ctx = buildAppAndStore();
  });
  afterEach(() => {
    ctx.store.close();
  });

  it('returns 422 when transition is not legal from current state', async () => {
    // first report succeeds
    await ctx.app.fetch(
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
    // second report on same aggregate → illegal (not in null state any more)
    const res = await ctx.app.fetch(
      new Request('http://x/v1/issues/42/actions/report', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          projectId: 1,
          reporterId: 2,
          title: 'y',
          priority: 'low',
          storyPoints: 1,
        }),
      }),
    );
    expect(res.status).toBe(422);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('COMMAND_ILLEGAL_TRANSITION');
  });
});
