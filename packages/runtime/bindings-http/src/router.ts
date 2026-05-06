import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import type { Context } from 'hono';
import type BetterSqlite3 from 'better-sqlite3';
import type { ValidatedBindings, OpenApiDoc } from '@rntme/bindings';
import type { EventStore, ActorRef } from '@rntme/event-store';
import type { OperationExecutor } from './operation-contract.js';
import { buildPlan } from './startup/compile-plan.js';
import { honoPath } from './startup/hono-path.js';
import { makeOperationHandler } from './runtime/operation-handler.js';
import { idempotencyMiddleware } from './idempotency/middleware.js';
import { IdempotencyCache } from './idempotency/cache.js';
import type { BindingsGraphRuntimeInputs } from './startup/runtime-inputs.js';
import { missingRuntimeDependencyError } from './errors.js';

export type BindingsRouterOptions = BindingsGraphRuntimeInputs & {
  validated: ValidatedBindings;
  db: BetterSqlite3.Database;
  openApiDoc?: OpenApiDoc;
  onError?: (err: unknown, ctx: Context) => void;
  /** Required when at least one action operation can append local events. */
  eventStore?: EventStore;
  /** Required for all operation bindings. */
  operationExecutor?: OperationExecutor;
  /** Per-request actor extractor for action operations. Default: () => null. */
  actorFromRequest?: (c: Context) => ActorRef | null;
  /** Default: () => new Date().toISOString() */
  now?: () => string;
  /** Default: () => crypto.randomUUID() */
  nextId?: () => string;
  idempotencyCache?: IdempotencyCache | undefined;
};

export function createBindingsRouter(opts: BindingsRouterOptions): Hono {
  const plan = buildPlan(opts.validated, opts.graphSpec, opts.pdm, opts.qsm);
  const app = new Hono();

  const planEntries = Object.values(plan.plans);
  const firstAction = planEntries.find((p) => p.exposure === 'action');
  if (firstAction !== undefined && !opts.eventStore) {
    throw missingRuntimeDependencyError(
      { bindingId: firstAction.bindingId, graphId: firstAction.entry.graph },
      'eventStore',
    );
  }
  if (planEntries.length > 0 && opts.operationExecutor === undefined) {
    const first = planEntries[0]!;
    throw missingRuntimeDependencyError(
      { bindingId: first.bindingId, graphId: first.entry.graph },
      'operationExecutor',
    );
  }

  const now = opts.now ?? ((): string => new Date().toISOString());
  const nextId = opts.nextId ?? ((): string => randomUUID());
  const actorFromRequest = opts.actorFromRequest ?? ((): ActorRef | null => null);
  const operationExecutor = opts.operationExecutor!;

  const cache = opts.idempotencyCache ?? new IdempotencyCache(opts.db);
  const pathToActionOperation: Map<string, string> = new Map();
  for (const bp of Object.values(plan.plans)) {
    if (bp.exposure === 'action') pathToActionOperation.set(bp.entry.http.path, bp.operationName);
  }
  app.use('*', idempotencyMiddleware({
    cache,
    now: () => Date.now(),
    operationNameFromPath: (p) => {
      const stripped = p.replace(/^\/api/, '') || '/';
      return pathToActionOperation.get(stripped) ?? pathToActionOperation.get(p) ?? null;
    },
  }));

  for (const bp of Object.values(plan.plans)) {
    const route = honoPath(bp.entry.http.path);
    const deps =
      opts.onError !== undefined
        ? {
            operationExecutor,
            eventStore: opts.eventStore ?? null,
            qsmDb: opts.db,
            now,
            nextId,
            actorFromRequest,
            onError: opts.onError,
            idempotencyCache: cache,
          }
        : {
            operationExecutor,
            eventStore: opts.eventStore ?? null,
            qsmDb: opts.db,
            now,
            nextId,
            actorFromRequest,
            idempotencyCache: cache,
          };
    if (bp.entry.http.method === 'GET') app.get(route, makeOperationHandler(bp, deps));
    else app.post(route, makeOperationHandler(bp, deps));
  }

  if (opts.openApiDoc !== undefined) {
    const doc = opts.openApiDoc;
    app.get('/openapi.json', (c) => c.json(doc));
  }

  return app;
}
