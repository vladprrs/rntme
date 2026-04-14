import { Hono } from 'hono';
import type { Context } from 'hono';
import type BetterSqlite3 from 'better-sqlite3';
import type { ValidatedBindings, OpenApiDoc } from '@rntme/bindings';
import { buildPlan } from './startup/compile-plan.js';
import { honoPath } from './startup/hono-path.js';
import { makeHandler } from './runtime/handler.js';

export type BindingsRouterOptions = {
  validated: ValidatedBindings;
  graphSpec: unknown;
  pdm: unknown;
  qsm: unknown;
  db: BetterSqlite3.Database;
  openApiDoc?: OpenApiDoc;
  onError?: (err: unknown, ctx: Context) => void;
};

export function createBindingsRouter(opts: BindingsRouterOptions): Hono {
  const plan = buildPlan(opts.validated, opts.graphSpec, opts.pdm, opts.qsm);
  const app = new Hono();

  for (const bp of Object.values(plan)) {
    const route = honoPath(bp.entry.http.path);
    const deps = opts.onError !== undefined
      ? { db: opts.db, onError: opts.onError }
      : { db: opts.db };
    const handler = makeHandler(bp, deps);
    if (bp.entry.http.method === 'GET') {
      app.get(route, handler);
    } else {
      app.post(route, handler);
    }
  }

  if (opts.openApiDoc !== undefined) {
    const doc = opts.openApiDoc;
    app.get('/openapi.json', (c) => c.json(doc));
  }

  return app;
}
