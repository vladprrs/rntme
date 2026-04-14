import { Hono } from 'hono';
import type { Context } from 'hono';
import type BetterSqlite3 from 'better-sqlite3';
import type { ValidatedBindings, OpenApiDoc } from '@rntme/bindings';
import type { EventStore, ActorRef } from '@rntme/event-store';
import { buildPlan } from './startup/compile-plan.js';
import { honoPath } from './startup/hono-path.js';
import { makeHandler } from './runtime/handler.js';
import { makeCommandHandler } from './runtime/command-handler.js';

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
  /** Per-request actor extractor for commands. Default: () => null. */
  actorFromRequest?: (c: Context) => ActorRef | null;
  /** Default: () => new Date().toISOString() */
  now?: () => string;
  /** Default: () => crypto.randomUUID() */
  nextId?: () => string;
};

export function createBindingsRouter(opts: BindingsRouterOptions): Hono {
  const plan = buildPlan(opts.validated, opts.graphSpec, opts.pdm, opts.qsm);
  const app = new Hono();

  const hasCommand = Object.values(plan).some((p) => p.kind === 'command');
  if (hasCommand && !opts.eventStore) {
    throw new Error(
      'createBindingsRouter: eventStore is required when any binding has kind "command"',
    );
  }

  const now = opts.now ?? ((): string => new Date().toISOString());
  const nextId = opts.nextId ?? ((): string => crypto.randomUUID());
  const actorFromRequest = opts.actorFromRequest ?? ((): ActorRef | null => null);

  for (const bp of Object.values(plan)) {
    const route = honoPath(bp.entry.http.path);
    if (bp.kind === 'command') {
      const deps =
        opts.onError !== undefined
          ? {
              eventStore: opts.eventStore!,
              qsmDb: opts.db,
              now,
              nextId,
              actorFromRequest,
              onError: opts.onError,
            }
          : {
              eventStore: opts.eventStore!,
              qsmDb: opts.db,
              now,
              nextId,
              actorFromRequest,
            };
      app.post(route, makeCommandHandler(bp, deps));
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
