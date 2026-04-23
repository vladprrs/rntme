import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import type { Context } from 'hono';
import type BetterSqlite3 from 'better-sqlite3';
import type { ValidatedBindings, OpenApiDoc } from '@rntme/bindings';
import type { EventStore, ActorRef } from '@rntme/event-store';
import type { ExternalAdapterClient, Metrics } from '@rntme/runtime';
import type { Logger } from 'pino';
import pino from 'pino';
import type { CommandExecutor } from './executor-contract.js';
import { buildPlan } from './startup/compile-plan.js';
import { honoPath } from './startup/hono-path.js';
import { makeHandler } from './runtime/handler.js';
import { makeCommandHandler } from './runtime/command-handler.js';
import { idempotencyMiddleware } from './idempotency/middleware.js';
import { IdempotencyCache } from './idempotency/cache.js';

export type BindingsRouterOptions = {
  validated: ValidatedBindings;
  graphSpec: unknown;
  pdm: unknown;
  qsm: unknown;
  db: BetterSqlite3.Database;
  openApiDoc?: OpenApiDoc;
  onError?: (err: unknown, ctx: Context) => void;
  /** Required when at least one binding has kind "command". */
  eventStore?: EventStore;
  /** Optional command executor for bindings-http runtime integration. */
  commandExecutor?: CommandExecutor;
  /** Per-request actor extractor for commands. Default: () => null. */
  actorFromRequest?: (c: Context) => ActorRef | null;
  /** Default: () => new Date().toISOString() */
  now?: () => string;
  /** Default: () => crypto.randomUUID() */
  nextId?: () => string;
  externalAdapterClient?: ExternalAdapterClient | undefined;
  idempotencyCache?: IdempotencyCache | undefined;
  logger?: Logger;
  metrics?: Metrics | undefined;
};

export function createBindingsRouter(opts: BindingsRouterOptions): Hono {
  const plan = buildPlan(opts.validated, opts.graphSpec, opts.pdm, opts.qsm);
  const app = new Hono();

  const hasCommand = Object.values(plan.plans).some((p) => p.kind === 'command');
  if (hasCommand && !opts.eventStore) {
    throw new Error(
      'createBindingsRouter: eventStore is required when any binding has kind "command"',
    );
  }
  if (hasCommand && opts.commandExecutor === undefined) {
    throw new Error(
      'createBindingsRouter: commandExecutor is required when any binding has kind "command"',
    );
  }
  const anyPre = Object.values(plan.plans).some((p) => p.kind === 'command' && p.pre.length > 0);
  if (anyPre && opts.externalAdapterClient === undefined) {
    throw new Error(
      'createBindingsRouter: externalAdapterClient is required when any command binding has pre[]',
    );
  }
  const commandExecutor = opts.commandExecutor!;

  const now = opts.now ?? ((): string => new Date().toISOString());
  const nextId = opts.nextId ?? ((): string => randomUUID());
  const actorFromRequest = opts.actorFromRequest ?? ((): ActorRef | null => null);
  const logger = opts.logger ?? pino({ level: process.env.LOG_LEVEL ?? 'info' });

  const cache = opts.idempotencyCache ?? new IdempotencyCache(opts.db);
  const pathToCommand: Map<string, string> = new Map();
  for (const bp of Object.values(plan.plans)) {
    if (bp.kind === 'command') pathToCommand.set(bp.entry.http.path, bp.commandName);
  }
  app.use('*', idempotencyMiddleware({
    cache,
    now: () => Date.now(),
    commandNameFromPath: (p) => {
      // Strip /api prefix since the router is mounted at /api
      const stripped = p.replace(/^\/api/, '') || '/';
      return pathToCommand.get(stripped) ?? pathToCommand.get(p) ?? null;
    },
  }));

  for (const bp of Object.values(plan.plans)) {
    const route = honoPath(bp.entry.http.path);
    if (bp.kind === 'command') {
      const deps =
        opts.onError !== undefined
          ? {
              commandExecutor,
              eventStore: opts.eventStore!,
              qsmDb: opts.db,
              now,
              nextId,
              actorFromRequest,
              onError: opts.onError,
              externalAdapterClient: opts.externalAdapterClient,
              idempotencyCache: cache,
              logger,
              metrics: opts.metrics,
            }
          : {
              commandExecutor,
              eventStore: opts.eventStore!,
              qsmDb: opts.db,
              now,
              nextId,
              actorFromRequest,
              externalAdapterClient: opts.externalAdapterClient,
              idempotencyCache: cache,
              logger,
              metrics: opts.metrics,
            };
      const method = bp.entry.http.method;
      if (method === 'POST') app.post(route, makeCommandHandler(bp, deps));
      else if (method === 'GET') app.get(route, makeCommandHandler(bp, deps));
      else throw new Error(`unsupported http.method on command binding "${bp.bindingId}": ${method}`);
    } else {
      const deps = opts.onError !== undefined ? { db: opts.db, onError: opts.onError } : { db: opts.db };
      const handler = makeHandler(bp, deps);
      if (bp.entry.http.method === 'GET') app.get(route, handler);
      else app.post(route, handler);
    }
  }

  if (opts.openApiDoc !== undefined) {
    const doc = opts.openApiDoc;
    app.get('/openapi.json', (c) => c.json(doc));
  }

  return app;
}
